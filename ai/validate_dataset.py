"""Transcribe an audio dataset and optionally score it against reference text."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

from benchmark_stt import edit_distance, normalize
from stt_service import STTConfig, STTEngine


AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".webm"}
CSV_FIELDS = (
    "file", "group", "reference", "transcript", "status", "error",
    "audio_duration_seconds", "processing_seconds", "real_time_factor",
    "character_errors", "reference_characters",
)


def load_references(path: Path) -> dict[str, tuple[str, str]]:
    """Read labels keyed by paths relative to the audio directory."""
    references: dict[str, tuple[str, str]] = {}
    with path.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        if not {"file", "reference"}.issubset(reader.fieldnames or []):
            raise ValueError("Reference CSV needs file and reference columns")
        for line_number, row in enumerate(reader, start=2):
            name = (row.get("file") or "").strip().replace("\\", "/")
            reference = (row.get("reference") or "").strip()
            if not name or not normalize(reference):
                raise ValueError(f"Missing file/reference on line {line_number}")
            relative = Path(name)
            if relative.is_absolute() or ".." in relative.parts:
                raise ValueError(f"Reference path must be relative to audio directory: {name}")
            if name in references:
                raise ValueError(f"Duplicate reference for {name}")
            references[name] = (reference, (row.get("group") or "").strip())
    return references


def run(
    audio_dir: Path,
    output_dir: Path,
    config: STTConfig,
    reference_csv: Path | None = None,
    limit: int | None = None,
) -> dict[str, object]:
    if not audio_dir.is_dir():
        raise NotADirectoryError(audio_dir)
    if limit is not None and limit < 1:
        raise ValueError("limit must be positive")

    audio_files = sorted(
        path for path in audio_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS
    )
    if not audio_files:
        raise ValueError(f"No supported audio files in {audio_dir}")
    references = load_references(reference_csv) if reference_csv else {}
    available = {path.relative_to(audio_dir).as_posix() for path in audio_files}
    missing = references.keys() - available
    if missing:
        raise ValueError(f"Reference files not found in audio directory: {', '.join(sorted(missing)[:5])}")

    selected = audio_files[:limit]
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / "dataset_validation.csv"
    json_path = output_dir / "dataset_validation_summary.json"
    engine = STTEngine(config)
    load_seconds = engine.load()
    succeeded = failed = labeled = exact_matches = errors = characters = 0
    total_processing_seconds = total_audio_seconds = 0.0

    with csv_path.open("w", newline="", encoding="utf-8-sig") as destination:
        writer = csv.DictWriter(destination, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for index, path in enumerate(selected, start=1):
            name = path.relative_to(audio_dir).as_posix()
            reference, group = references.get(name, ("", ""))
            row = dict.fromkeys(CSV_FIELDS, "")
            row.update(file=name, group=group, reference=reference)
            try:
                with path.open("rb") as audio:
                    result = engine.transcribe(audio)
                row["transcript"] = result.text
                row["status"] = "ok"
                row["processing_seconds"] = round(result.processing_seconds, 3)
                total_processing_seconds += result.processing_seconds
                if result.audio_duration_seconds:
                    row["audio_duration_seconds"] = round(result.audio_duration_seconds, 3)
                    row["real_time_factor"] = round(
                        result.processing_seconds / result.audio_duration_seconds, 3
                    )
                    total_audio_seconds += result.audio_duration_seconds
                succeeded += 1
                if reference:
                    expected = normalize(reference)
                    actual = normalize(result.text)
                    sample_errors = edit_distance(expected, actual)
                    row["character_errors"] = sample_errors
                    row["reference_characters"] = len(expected)
                    labeled += 1
                    errors += sample_errors
                    characters += len(expected)
                    exact_matches += sample_errors == 0
            except Exception as exc:
                row["status"] = "error"
                row["error"] = f"{type(exc).__name__}: {exc}"
                failed += 1
            writer.writerow(row)
            print(f"[{index}/{len(selected)}] {name}: {row['status']}", file=sys.stderr)

    summary = {
        "model": config.model_name,
        "device": config.device,
        "compute_type": config.compute_type,
        "audio_files_found": len(audio_files),
        "processed": len(selected),
        "succeeded": succeeded,
        "failed": failed,
        "labeled": labeled,
        "normalized_cer": round(errors / characters, 4) if characters else None,
        "exact_match_rate": round(exact_matches / labeled, 4) if labeled else None,
        "model_load_seconds": round(load_seconds, 3),
        "processing_seconds_total": round(total_processing_seconds, 3),
        "overall_real_time_factor": (
            round(total_processing_seconds / total_audio_seconds, 3)
            if total_audio_seconds else None
        ),
        "results_csv": str(csv_path),
    }
    json_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--audio-dir", type=Path, required=True)
    parser.add_argument("--reference-csv", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).parent / "benchmark_results")
    parser.add_argument("--limit", type=int, help="Transcribe only the first N files for a quick check")
    defaults = STTConfig.from_env()
    parser.add_argument("--model", default=defaults.model_name)
    parser.add_argument("--device", default=defaults.device)
    parser.add_argument("--compute-type", default=defaults.compute_type)
    args = parser.parse_args()
    summary = run(
        args.audio_dir, args.output_dir,
        STTConfig(args.model, args.device, args.compute_type),
        args.reference_csv, args.limit,
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if summary["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
