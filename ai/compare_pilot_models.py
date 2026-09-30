"""Compare medium and large-v3 transcripts from the same pilot XLSX and audio ZIP."""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
from pathlib import Path


MODELS = ("medium", "large-v3")
SHARED_COLUMNS = ("파일명", "STT ID", "정답 문장", "메뉴", "발화 유형", "원본 파일명")
MODEL_COLUMNS = (
    "STT 추출 결과", "정확히 일치", "정규화 CER", "처리 시간(초)", "상태", "오류 메모",
)
COMPARISON_COLUMNS = SHARED_COLUMNS + tuple(
    f"{model} {column}" for model in MODELS for column in MODEL_COLUMNS
)


def run_model(
    model: str,
    evaluation_xlsx: Path,
    audio_zip: Path,
    output_csv: Path,
    device: str,
    compute_type: str,
    limit: int | None,
    overwrite: bool,
) -> dict[str, object]:
    command = [
        sys.executable, str(Path(__file__).with_name("evaluate_pilot_xlsx.py")),
        "--evaluation-xlsx", str(evaluation_xlsx),
        "--audio-zip", str(audio_zip),
        "--output-csv", str(output_csv),
        "--model", model,
        "--device", device,
        "--compute-type", compute_type,
    ]
    if limit is not None:
        command.extend(("--limit", str(limit)))
    if overwrite:
        command.append("--overwrite")
    summary_path = output_csv.with_suffix(".summary.json")
    previous_mtimes = {
        path: path.stat().st_mtime_ns if path.exists() else None
        for path in (output_csv, summary_path)
    }
    print(f"\nRunning {model} in a separate process", file=sys.stderr)
    completed = subprocess.run(command, check=False)
    if any(
        not path.is_file() or path.stat().st_mtime_ns == previous_mtimes[path]
        for path in (output_csv, summary_path)
    ):
        raise RuntimeError(f"{model} did not produce results (exit code {completed.returncode})")
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    if completed.returncode not in (0, 1):
        raise RuntimeError(f"{model} process failed (exit code {completed.returncode})")
    return summary


def read_results(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        required = set(SHARED_COLUMNS + MODEL_COLUMNS)
        if not required.issubset(reader.fieldnames or []):
            raise ValueError(f"Missing result columns in {path}")
        return list(reader)


def merge_results(medium_csv: Path, large_csv: Path, comparison_csv: Path) -> dict[str, int]:
    medium_rows = read_results(medium_csv)
    large_rows = read_results(large_csv)
    if len(medium_rows) != len(large_rows):
        raise ValueError("Model result row counts differ")
    for medium, large in zip(medium_rows, large_rows):
        if any(medium[column] != large[column] for column in SHARED_COLUMNS):
            raise ValueError(f"Model results do not align at {medium['원본 파일명']}")

    comparison_csv.parent.mkdir(parents=True, exist_ok=True)
    better = {"medium": 0, "large-v3": 0, "tie": 0}
    with comparison_csv.open("w", newline="", encoding="utf-8-sig") as destination:
        writer = csv.DictWriter(destination, fieldnames=COMPARISON_COLUMNS)
        writer.writeheader()
        for medium, large in zip(medium_rows, large_rows):
            row = {column: medium[column] for column in SHARED_COLUMNS}
            for model, source in (("medium", medium), ("large-v3", large)):
                for column in MODEL_COLUMNS:
                    row[f"{model} {column}"] = source[column]
            writer.writerow(row)
            if medium["상태"] == large["상태"] == "ok":
                medium_cer = float(medium["정규화 CER"])
                large_cer = float(large["정규화 CER"])
                better["medium" if medium_cer < large_cer else "large-v3" if large_cer < medium_cer else "tie"] += 1
    return better


def run_comparison(
    evaluation_xlsx: Path,
    audio_zip: Path,
    output_dir: Path,
    device: str,
    compute_type: str,
    *,
    limit: int | None = None,
    overwrite: bool = False,
) -> dict[str, object]:
    if limit is not None and limit < 1:
        raise ValueError("limit must be positive")
    if not evaluation_xlsx.is_file():
        raise FileNotFoundError(evaluation_xlsx)
    if not audio_zip.is_file():
        raise FileNotFoundError(audio_zip)
    outputs = {model: output_dir / f"pilot_{model}.csv" for model in MODELS}
    comparison_csv = output_dir / "pilot_medium_vs_large-v3.csv"
    summary_path = output_dir / "pilot_medium_vs_large-v3.summary.json"
    expected_outputs = [comparison_csv, summary_path]
    for path in outputs.values():
        expected_outputs.extend((path, path.with_suffix(".summary.json")))
    if not overwrite and any(path.exists() for path in expected_outputs):
        raise FileExistsError("Pilot comparison output exists; choose another directory or use --overwrite")
    output_dir.mkdir(parents=True, exist_ok=True)

    summaries = {
        model: run_model(model, evaluation_xlsx, audio_zip, outputs[model], device, compute_type, limit, overwrite)
        for model in MODELS
    }
    better = merge_results(outputs["medium"], outputs["large-v3"], comparison_csv)
    medium = summaries["medium"]
    large = summaries["large-v3"]
    complete = all(
        summary["failed"] == summary["missing_audio"] == 0
        and summary["succeeded"] == summary["processed"]
        for summary in summaries.values()
    )
    comparison = {
        "evaluation_rows": medium["evaluation_rows"],
        "processed": medium["processed"],
        "device": device,
        "compute_type": compute_type,
        "models": summaries,
        "per_file_lower_cer": better,
        "complete_comparison": complete,
        "exact_match_gain_large_v3_percentage_points": (
            round((large["exact_match_rate"] - medium["exact_match_rate"]) * 100, 2)
            if complete else None
        ),
        "cer_reduction_large_v3": (
            round(medium["normalized_cer"] - large["normalized_cer"], 4)
            if complete else None
        ),
        "comparison_csv": str(comparison_csv),
    }
    summary_path.write_text(json.dumps(comparison, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return comparison


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evaluation-xlsx", type=Path, required=True)
    parser.add_argument("--audio-zip", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).parent / "benchmark_results")
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--compute-type", default="float16")
    parser.add_argument("--limit", type=int, help="Compare only the first N rows")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    summary = run_comparison(
        args.evaluation_xlsx, args.audio_zip, args.output_dir,
        args.device, args.compute_type, limit=args.limit, overwrite=args.overwrite,
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if not summary["complete_comparison"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
