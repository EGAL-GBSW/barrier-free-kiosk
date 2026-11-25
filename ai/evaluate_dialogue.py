"""Evaluate REAL Ollama extraction against the 40 handwritten text examples."""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path

from dialogue_design import validate_assets as assets
from dialogue_design.conversation import load_runtime_catalog
from dialogue_design.ollama_client import DEFAULT_MODEL, DEFAULT_URL, ModelError, OllamaClient, PredictionError


def semantic_fields(prediction: dict) -> dict:
    clarification = prediction["clarification"]
    return {
        "intent": prediction["intent"], "set": prediction["set"], "clear": sorted(prediction["clear"]),
        "clarification": None if clarification is None else {"reason": clarification["reason"], "fields": sorted(clarification["fields"])},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--ollama-url", default=DEFAULT_URL)
    parser.add_argument("--timeout", type=float, default=180)
    parser.add_argument("--num-ctx", type=int, default=8192)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit은 1 이상이어야 합니다.")
    try:
        assets.validate_assets()
        client = OllamaClient(args.model, args.ollama_url, args.timeout, args.num_ctx)
        check = client.check()
        if not check["installed"]:
            raise ModelError(f"모델을 먼저 받으세요: ollama pull {args.model}")
        output_dir = args.output_dir or Path(__file__).parent / "benchmark_results" / ("dialogue_eval_" + datetime.now().strftime("%Y%m%d_%H%M%S_%f"))
        output_dir.mkdir(parents=True, exist_ok=False)
    except (ValueError, OSError, ModelError) as exc:
        print(f"평가 준비 오류: {exc}", file=sys.stderr)
        return 1
    cases = assets.load_examples()[:args.limit]
    counts = {"processed": 0, "valid": 0, "failed": 0, "exact": 0, "intent": 0, "set": 0, "clear": 0, "clarification": 0, "filter_checked": 0, "filter_matched": 0}
    times = []
    interrupted = False
    with (output_dir / "predictions.jsonl").open("w", encoding="utf-8") as destination:
        try:
            for case in cases:
                record = {"id": case["id"], "group": case["group"], "catalog": case["catalog"], "utterance": case["utterance"], "expected": case["expected"], "expected_filter": case.get("expected_filter")}
                catalog = load_runtime_catalog(demo=case["catalog"] == "demo")
                try:
                    # Only catalog/context/utterance enter the model, never case.expected.
                    prediction, inference = client.extract(catalog, case["context"], case["utterance"])
                    actual = semantic_fields(prediction)
                    expected = semantic_fields(case["expected"])
                    same = actual == expected
                    counts["valid"] += 1
                    counts["exact"] += same
                    for key in ("intent", "set", "clear", "clarification"):
                        counts[key] += actual[key] == expected[key]
                    state = assets.apply_patch(case["context"]["state"], prediction)
                    filtered = assets.filter_catalog(catalog, state)
                    if "expected_filter" in case:
                        counts["filter_matched"] += all(filtered[key] == value for key, value in case["expected_filter"].items())
                    times.append(inference["wall_seconds"])
                    record.update(prediction=prediction, semantic_match=same, inference=inference, actual_filter=filtered)
                    print(f"{case['id']}: {'일치' if same else '불일치'}")
                except (ModelError, PredictionError) as exc:
                    counts["failed"] += 1
                    record["error"] = str(exc)
                    print(f"{case['id']}: 오류: {exc}", file=sys.stderr)
                counts["processed"] += 1
                if "expected_filter" in case:
                    counts["filter_checked"] += 1
                destination.write(json.dumps(record, ensure_ascii=False) + "\n")
                destination.flush()
        except KeyboardInterrupt:
            interrupted = True
    denominator = counts["processed"] or 1
    summary = {
        "model": args.model, "timestamp_utc": datetime.now(timezone.utc).isoformat(), "interrupted": interrupted,
        "counts": counts,
        "exact_extraction_rate": round(counts["exact"] / denominator, 4),
        "field_rates": {key: round(counts[key] / denominator, 4) for key in ("intent", "set", "clear", "clarification")},
        "filter_match_rate": round(counts["filter_matched"] / counts["filter_checked"], 4) if counts["filter_checked"] else None,
        "latency_median_seconds": round(statistics.median(times), 3) if times else None,
        "results_directory": str(output_dir),
        "note": "독립 발화 조건 추출 평가. 각 예시의 제공된 이전 문맥을 사용하며 자유 대화 성공률·음성 인식 정확도가 아니다. evidence와 추천 순서는 의미 일치 점수에서 제외한다.",
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 1 if counts["failed"] or interrupted else 0


if __name__ == "__main__":
    raise SystemExit(main())
