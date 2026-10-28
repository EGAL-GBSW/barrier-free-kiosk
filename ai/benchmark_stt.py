"""Run one Whisper model over a labeled order-audio manifest."""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import unicodedata
from pathlib import Path

from stt_service import STTConfig, STTEngine


def normalize(text: str) -> str:
    """Compare Korean characters without spacing or punctuation differences."""
    return "".join(
        ch for ch in unicodedata.normalize("NFC", text).lower()
        if not ch.isspace() and not unicodedata.category(ch).startswith("P")
    )


def edit_distance(left: str, right: str) -> int:
    previous = list(range(len(right) + 1))
    for row, left_char in enumerate(left, start=1):
        current = [row]
        for col, right_char in enumerate(right, start=1):
            current.append(min(
                current[col - 1] + 1,
                previous[col] + 1,
                previous[col - 1] + (left_char != right_char),
            ))
        previous = current
    return previous[-1]


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    rank = max(0, (len(ordered) - 1) * fraction)
    lower = int(rank)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (rank - lower)


def run(manifest: Path, config: STTConfig, warmup_runs: int = 1) -> dict[str, object]:
    if warmup_runs < 0:
        raise ValueError("warmup_runs must be non-negative")
    samples: list[tuple[str, Path, str, str]] = []
    with manifest.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        if not {"file", "reference"}.issubset(reader.fieldnames or []):
            raise ValueError("Manifest needs file and reference columns")

        for line_number, sample in enumerate(reader, start=2):
            raw_path = (sample.get("file") or "").strip()
            reference = (sample.get("reference") or "").strip()
            if not raw_path or not normalize(reference):
                raise ValueError(f"Missing file/reference on manifest line {line_number}")
            audio_path = Path(raw_path)
            if not audio_path.is_absolute():
                audio_path = manifest.parent / audio_path
            if not audio_path.is_file():
                raise FileNotFoundError(audio_path)
            samples.append((raw_path, audio_path, reference, (sample.get("group") or "").strip()))

    if not samples:
        raise ValueError("Manifest has no samples")

    engine = STTEngine(config)
    model_load_seconds = engine.load()
    for _ in range(warmup_runs):
        with samples[0][1].open("rb") as audio:
            engine.transcribe(audio)
    rows: list[dict[str, object]] = []
    errors = 0
    characters = 0
    times: list[float] = []
    groups: dict[str, dict[str, object]] = {}

    for raw_path, audio_path, reference, group in samples:
        with audio_path.open("rb") as audio:
            result = engine.transcribe(audio)
        expected = normalize(reference)
        actual = normalize(result.text)
        sample_errors = edit_distance(expected, actual)
        errors += sample_errors
        characters += len(expected)
        times.append(result.processing_seconds)
        rows.append({
            "file": raw_path,
            "group": group,
            "reference": reference,
            "transcript": result.text,
            "processing_seconds": round(result.processing_seconds, 3),
            "audio_duration_seconds": result.audio_duration_seconds,
            "character_errors": sample_errors,
        })
        summary = groups.setdefault(group or "unlabeled", {"errors": 0, "characters": 0, "times": []})
        summary["errors"] += sample_errors
        summary["characters"] += len(expected)
        summary["times"].append(result.processing_seconds)

    group_results = {
        group: {
            "samples": len(summary["times"]),
            "normalized_cer": round(summary["errors"] / summary["characters"], 4),
            "latency_p95_seconds": round(percentile(summary["times"], 0.95), 3),
        }
        for group, summary in groups.items()
    }
    return {
        "model": config.model_name,
        "device": config.device,
        "compute_type": config.compute_type,
        "samples": len(rows),
        "warmup_runs": warmup_runs,
        "model_load_seconds": round(model_load_seconds, 3),
        "normalized_cer": round(errors / characters, 4),
        "latency_p50_seconds": round(statistics.median(times), 3),
        "latency_p95_seconds": round(percentile(times, 0.95), 3),
        "groups": group_results,
        "results": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--model", choices=("medium", "large-v3"), required=True)
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--compute-type", default="float16")
    parser.add_argument("--warmup-runs", type=int, default=1)
    args = parser.parse_args()
    report = run(args.manifest, STTConfig(args.model, args.device, args.compute_type), args.warmup_runs)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
