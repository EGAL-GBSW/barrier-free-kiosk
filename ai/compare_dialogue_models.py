"""Compare local Ollama models on the same annotated Korean menu utterances."""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

from dialogue_design import validate_assets as assets
from dialogue_design.conversation import load_runtime_catalog
from dialogue_design.ollama_client import DEFAULT_URL, ModelError, OllamaClient, PredictionError
from evaluate_dialogue import semantic_fields


DEFAULT_MODELS = (
    "qwen3:4b-instruct-2507-q4_K_M",
    "qwen3.5:4b-q4_K_M",
    "qwen3.5:9b-q4_K_M",
)
DETAIL_FIELDS = (
    "model", "repeat", "case_id", "group", "catalog", "utterance", "status", "error",
    "exact_match", "set_match", "clear_match", "intent_match", "clarification_match",
    "expected", "predicted", "expected_set_field_count", "predicted_set_field_count", "correct_set_field_count",
    "elapsed_seconds", "attempts",
)
SUMMARY_FIELDS = (
    "model", "planned", "total", "valid", "failed", "exact", "set", "clear",
    "exact_rate", "set_rate", "clear_rate", "intent_rate", "clarification_rate",
    "set_nonempty_total", "set_nonempty_rate", "slot_reference_count", "slot_prediction_count", "slot_correct_count",
    "slot_precision_rate", "slot_recall_rate",
    "latency_success_count", "latency_median_seconds", "latency_mean_seconds", "latency_p95_seconds",
    "failed_latency_count", "warmup_status", "warmup_seconds", "warmup_error", "unload_error",
    "source_total", "source_exact_rate", "source_set_rate", "demo_total", "demo_exact_rate", "demo_set_rate",
)


def parser_for_comparison() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models", nargs="+", default=list(DEFAULT_MODELS), help="Ollama model tags to compare")
    parser.add_argument("--ollama-url", default=DEFAULT_URL)
    parser.add_argument("--timeout", type=float, default=180)
    parser.add_argument("--num-ctx", type=int, default=8192)
    parser.add_argument("--retries", type=int, choices=(0, 1, 2), default=1)
    parser.add_argument("--catalog", choices=("all", "source", "demo"), default="all")
    parser.add_argument("--limit", type=int, help="Maximum number of examples per model")
    parser.add_argument("--repeats", type=int, default=1, help="Repeat the same cases for each model")
    parser.add_argument("--output-dir", type=Path, help="New output directory (must not already exist)")
    return parser


def make_client(model: str, args: argparse.Namespace) -> OllamaClient:
    # The 2507 Instruct model has no thinking mode. Qwen3.5 must explicitly
    # disable it so reasoning tokens do not consume the JSON output budget.
    think = False if model.lower().startswith("qwen3.5:") else None
    return OllamaClient(model, args.ollama_url, args.timeout, args.num_ctx, args.retries, think=think)


def new_counts() -> dict:
    return {key: 0 for key in ("total", "valid", "failed", "exact", "set", "clear", "intent", "clarification",
                                 "set_nonempty_total", "set_nonempty_correct", "slot_reference_count", "slot_prediction_count", "slot_correct_count")}


def rates_for(counts: dict) -> dict:
    total = counts["total"]
    result = {key: round(counts[key] / total, 4) if total else None for key in ("exact", "set", "clear", "intent", "clarification")}
    result["set_nonempty"] = round(counts["set_nonempty_correct"] / counts["set_nonempty_total"], 4) if counts["set_nonempty_total"] else None
    result["slot_precision"] = round(counts["slot_correct_count"] / counts["slot_prediction_count"], 4) if counts["slot_prediction_count"] else None
    result["slot_recall"] = round(counts["slot_correct_count"] / counts["slot_reference_count"], 4) if counts["slot_reference_count"] else None
    return result


def percentile95(values: list[float]) -> float | None:
    return round(sorted(values)[math.ceil(len(values) * 0.95) - 1], 3) if values else None


def build_model_summary(model: str, planned: int, counts: dict, categories: dict, times: list[float],
                        failure_times: list[float], warmup: dict, unload_error: str | None) -> dict:
    return {
        "model": model, "planned": planned, "counts": counts, "rates": rates_for(counts),
        "by_catalog": {key: {"counts": value, "rates": rates_for(value)} for key, value in categories.items()},
        "latency": {
            "success_count": len(times),
            "median_seconds": round(statistics.median(times), 3) if times else None,
            "mean_seconds": round(statistics.mean(times), 3) if times else None,
            "p95_seconds": percentile95(times),
            "failed_count": len(failure_times),
        },
        "warmup": warmup, "unload_error": unload_error,
    }


def summary_row(item: dict) -> dict:
    counts, rates, latency, warmup = item["counts"], item["rates"], item["latency"], item["warmup"]
    row = {"model": item["model"], "planned": item["planned"], **counts}
    row.update({key + "_rate": value for key, value in rates.items()})
    row.update({"latency_success_count": latency["success_count"], "latency_median_seconds": latency["median_seconds"],
                "latency_mean_seconds": latency["mean_seconds"], "latency_p95_seconds": latency["p95_seconds"],
                "failed_latency_count": latency["failed_count"], "warmup_status": warmup["status"],
                "warmup_seconds": warmup["seconds"], "warmup_error": warmup.get("error"), "unload_error": item["unload_error"]})
    for category, data in item["by_catalog"].items():
        row.update({category + "_total": data["counts"]["total"], category + "_exact_rate": data["rates"]["exact"],
                    category + "_set_rate": data["rates"]["set"]})
    return {key: row.get(key) for key in SUMMARY_FIELDS}


def write_summary(path: Path, report: dict) -> None:
    (path / "summary.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with (path / "summary.csv").open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=SUMMARY_FIELDS)
        writer.writeheader()
        writer.writerows(summary_row(item) for item in report["models"])


def evaluate_case(client: OllamaClient, case: dict, catalog: dict, repetition: int) -> tuple[dict, float | None, float | None]:
    record = {"model": client.model, "repeat": repetition, "case_id": case["id"], "group": case["group"],
              "catalog": case["catalog"], "utterance": case["utterance"],
              "expected": json.dumps(semantic_fields(case["expected"]), ensure_ascii=False),
              "expected_set_field_count": len(case["expected"]["set"]), "predicted_set_field_count": 0, "correct_set_field_count": 0}
    start = perf_counter()
    try:
        # Gold is never supplied to the model. Each model sees the same provided context.
        prediction, inference = client.extract(catalog, case["context"], case["utterance"])
        elapsed = perf_counter() - start
        actual, expected = semantic_fields(prediction), semantic_fields(case["expected"])
        record.update(status="ok", error="", predicted=json.dumps(actual, ensure_ascii=False),
                      exact_match=actual == expected,
                      **{key + "_match": actual[key] == expected[key] for key in ("intent", "set", "clear", "clarification")},
                      predicted_set_field_count=len(actual["set"]),
                      correct_set_field_count=sum(field in actual["set"] and actual["set"][field] == value for field, value in expected["set"].items()),
                      elapsed_seconds=round(elapsed, 3), attempts=inference.get("attempts"))
        return record, elapsed, None
    except (ModelError, PredictionError) as exc:
        elapsed = perf_counter() - start
        record.update(status="error", error=str(exc), elapsed_seconds=round(elapsed, 3))
        return record, None, elapsed


def main() -> int:
    parser = parser_for_comparison()
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1 or args.repeats < 1:
        parser.error("--limit과 --repeats는 1 이상이어야 합니다.")
    if len(set(args.models)) != len(args.models):
        parser.error("같은 모델 태그를 중복 지정할 수 없습니다.")
    try:
        assets.validate_assets()
        cases = [case for case in assets.load_examples() if args.catalog == "all" or case["catalog"] == args.catalog]
        cases = cases[:args.limit]
        if not cases:
            raise ValueError("선택한 평가 문항이 없습니다.")
        catalogs = {key: load_runtime_catalog(demo=key == "demo") for key in ("source", "demo")}
        clients = [make_client(model, args) for model in args.models]
        missing = [client.model for client in clients if not client.check()["installed"]]
        if missing:
            raise ModelError("다음 모델을 먼저 설치하세요:\n" + "\n".join("ollama pull " + model for model in missing))
        output_dir = args.output_dir or Path(__file__).parent / "benchmark_results" / ("compare_dialogue_" + datetime.now().strftime("%Y%m%d_%H%M%S_%f"))
        output_dir.mkdir(parents=True, exist_ok=False)
    except (ValueError, OSError, ModelError) as exc:
        print(f"평가 준비 오류: {exc}", file=sys.stderr)
        return 1

    report = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(), "interrupted": False,
        "settings": {"models": args.models, "cases": len(cases), "repeats": args.repeats, "catalog": args.catalog,
                     "num_ctx": args.num_ctx, "retries": args.retries, "temperature": 0,
                     "case_ids": [case["id"] for case in cases], "warmup_per_model": 1},
        "note": "모든 모델에 동일한 정답 기반 문맥을 제공하는 독립 발화 평가. 음성 인식이나 전체 대화 성공률이 아님. 성공 요청 시간은 예열 제외, 재시도 포함; 오류는 정확도 분모에 포함.",
        "models": [],
    }
    interrupted = False
    try:
        with (output_dir / "details.csv").open("w", encoding="utf-8-sig", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=DETAIL_FIELDS)
            writer.writeheader()
            for client in clients:
                print(f"\n모델: {client.model} | 예열 중...", flush=True)
                counts = new_counts()
                categories = {key: new_counts() for key in ("source", "demo")}
                times: list[float] = []
                failure_times: list[float] = []
                warmup = {"status": "interrupted", "seconds": None}
                unload_error = None
                started = perf_counter()
                try:
                    try:
                        client.extract(catalogs[cases[0]["catalog"]], cases[0]["context"], cases[0]["utterance"])
                        warmup = {"status": "ok", "seconds": round(perf_counter() - started, 3)}
                    except (ModelError, PredictionError) as exc:
                        warmup = {"status": "error", "seconds": round(perf_counter() - started, 3), "error": str(exc)}
                        print(f"예열 오류(본 평가는 계속): {exc}", file=sys.stderr, flush=True)
                    for repetition in range(1, args.repeats + 1):
                        for case in cases:
                            record, elapsed, failed_elapsed = evaluate_case(client, case, catalogs[case["catalog"]], repetition)
                            for bucket in (counts, categories[case["catalog"]]):
                                bucket["total"] += 1
                                bucket["valid" if record["status"] == "ok" else "failed"] += 1
                                for key in ("exact", "set", "clear", "intent", "clarification"):
                                    bucket[key] += bool(record.get(key + "_match", False))
                                bucket["set_nonempty_total"] += bool(record["expected_set_field_count"])
                                bucket["set_nonempty_correct"] += bool(record["expected_set_field_count"] and record.get("set_match", False))
                                bucket["slot_reference_count"] += record["expected_set_field_count"]
                                bucket["slot_prediction_count"] += record["predicted_set_field_count"]
                                bucket["slot_correct_count"] += record["correct_set_field_count"]
                            if elapsed is not None:
                                times.append(elapsed)
                            if failed_elapsed is not None:
                                failure_times.append(failed_elapsed)
                            writer.writerow(record)
                            output.flush()
                            print(f"{client.model} | {repetition}/{args.repeats} | {case['id']}: {record['status']} ({record['elapsed_seconds']}초)", flush=True)
                finally:
                    # Only unload the model used by this benchmark, to reduce competition
                    # for VRAM when moving to the next model. Other applications may use it.
                    try:
                        client._request("/api/generate", {"model": client.model, "keep_alive": 0})
                    except ModelError as exc:
                        unload_error = str(exc)
                        print(f"모델 메모리 해제 실패: {exc}", file=sys.stderr, flush=True)
                    report["models"].append(build_model_summary(client.model, len(cases) * args.repeats, counts,
                                                                categories, times, failure_times, warmup, unload_error))
                    write_summary(output_dir, report)
    except KeyboardInterrupt:
        interrupted = True
        report["interrupted"] = True
    finally:
        write_summary(output_dir, report)

    print(f"\n결과 폴더: {output_dir}")
    for item in report["models"]:
        print(f"{item['model']}: 조건(set) 일치율 {item['rates']['set']}, 전체 일치율 {item['rates']['exact']}, "
              f"중앙 응답 {item['latency']['median_seconds']}초, 오류 {item['counts']['failed']}/{item['counts']['total']}")
    return 1 if interrupted or any(item["counts"]["failed"] or item["warmup"]["status"] != "ok" or item["unload_error"] for item in report["models"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
