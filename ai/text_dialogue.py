"""Interactive local SLM menu dialogue for Windows/A4000; text only, no orders sent."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from dialogue_design import validate_assets as assets
from dialogue_design.conversation import Conversation, load_runtime_catalog
from dialogue_design.ollama_client import DEFAULT_MODEL, DEFAULT_URL, ModelError, OllamaClient, PredictionError


HELP = "/menus 메뉴 목록 | /state 선택 상태 | /cart 테스트 장바구니 | /reset 현재 선택 초기화 | /quit 종료"


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--ollama-url", default=DEFAULT_URL)
    parser.add_argument("--timeout", type=float, default=180)
    parser.add_argument("--num-ctx", type=int, default=8192)
    parser.add_argument("--retries", type=int, choices=(0, 1, 2), default=1)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--menu-file", type=Path, help="Read the backend-shaped JSON array or a catalog with a menus array")
    source.add_argument("--menu-url", help="Read a running backend GET /menus endpoint")
    source.add_argument("--demo", action="store_true", help="Explicitly enable fictional milk/caffeine/size attributes for the design scenario")
    parser.add_argument("--check", action="store_true", help="Check Ollama connectivity and whether the selected model was pulled")
    parser.add_argument("--scenario", choices=("registered", "grandfather", "direct"), help="Run handwritten utterances through the REAL model and session; no gold outputs injected")
    parser.add_argument("--debug", action="store_true", help="Show extracted JSON, menu filters, state and timing")
    parser.add_argument("--log-file", type=Path, help="Append JSONL conversation records; use benchmark_results/ to keep logs out of Git")
    return parser


def log_record(path: Path | None, record: dict) -> None:
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as destination:
            destination.write(json.dumps(record, ensure_ascii=False) + "\n")


def scenario_utterances(name: str, demo: bool) -> list[str]:
    if name == "grandfather":
        if not demo:
            raise ValueError("grandfather는 우유·사이즈 가정이 들어간 시나리오입니다. --demo를 추가하거나 --scenario registered를 사용하세요.")
        return [case["utterance"] for case in assets.load_examples() if case["group"] == "grandfather_discovery"]
    if name == "direct":
        return ["아이스 카페 라떼 큰 걸로 두 잔 주세요." if demo else "아이스 카페 라떼 두 잔 주세요.", "그래, 담아 줘."]
    return ["시원한 커피 한 잔 마시고 싶네.", "아메리카노로 할게.", "그래, 담아 줘."]


def run_turn(client: OllamaClient, session: Conversation, utterance: str) -> dict:
    try:
        prediction, inference = client.extract(session.catalog, session.context(), utterance)
        result = session.handle_prediction(utterance, prediction)
    except (ModelError, PredictionError):
        session.abandon_confirmation()
        raise
    result["inference"] = inference
    return result


def main() -> int:
    parser = make_parser()
    args = parser.parse_args()
    try:
        catalog = load_runtime_catalog(menu_file=args.menu_file, menu_url=args.menu_url, demo=args.demo)
        client = OllamaClient(args.model, args.ollama_url, args.timeout, args.num_ctx, args.retries)
        scripted = scenario_utterances(args.scenario, args.demo) if args.scenario else None
        if args.check:
            result = client.check()
            result.update(menu_count=len(catalog["menus"]), catalog_status=catalog["data_status"], num_ctx=args.num_ctx)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            if not result["installed"]:
                print(f"모델 설치: ollama pull {args.model}", file=sys.stderr)
                return 1
            return 0
    except (ValueError, OSError, ModelError) as exc:
        print(f"실행 준비 오류: {exc}", file=sys.stderr)
        return 1

    session = Conversation(catalog)
    session_id = uuid4().hex
    print(f"모델: {args.model} | Ollama: {args.ollama_url}")
    print(f"메뉴 {len(catalog['menus'])}개 | 데이터: {catalog['data_status']}")
    if catalog["data_status"] == "demo_only":
        print("[데모] 우유·카페인·단맛·사이즈의 가상 속성을 사용합니다.")
    else:
        print("[기본 메뉴] 등록된 분류·설명·온도·수량으로 테스트합니다. 미등록 성분·사이즈는 확정하지 않습니다.")
    print("장바구니는 이 프로그램 안의 테스트 목록입니다. 실제 주문·결제를 전송하지 않습니다.")
    print(HELP)
    print("키오스크> 어떤 걸 드시고 싶으세요? 메뉴 이름을 모르셔도 편하게 말씀해 주세요.")
    iterator = iter(scripted) if scripted is not None else None
    last_action = None
    while True:
        try:
            utterance = next(iterator) if iterator is not None else input("사용자> ").strip()
            if iterator is not None:
                print("사용자> " + utterance)
        except (EOFError, StopIteration):
            break
        except KeyboardInterrupt:
            print("\n종료합니다.")
            return 0
        if not utterance:
            continue
        if utterance in ("/quit", "/exit"):
            break
        if utterance == "/help":
            print(HELP)
            continue
        if utterance == "/reset":
            session.reset()
            print("키오스크> 현재 고르던 메뉴를 초기화했어요. 테스트 장바구니는 유지됩니다.")
            continue
        if utterance in ("/state", "/cart", "/menus"):
            value = session.context() if utterance == "/state" else session.cart if utterance == "/cart" else catalog["menus"]
            print(json.dumps(value, ensure_ascii=False, indent=2))
            continue
        if utterance.startswith("/"):
            print(HELP)
            continue
        record = {"session_id": session_id, "timestamp_utc": datetime.now(timezone.utc).isoformat(), "model": args.model, "catalog_status": catalog["data_status"], "utterance": utterance}
        try:
            result = run_turn(client, session, utterance)
            print("키오스크> " + result["reply"])
            print("선택 상태> " + json.dumps({key: value for key, value in result["state"].items() if value is not None}, ensure_ascii=False))
            if args.debug:
                print(json.dumps(result, ensure_ascii=False, indent=2))
            record["result"] = result
            last_action = result["action"]
        except (ModelError, PredictionError) as exc:
            print(f"처리 오류> {exc}\n선택은 확정되지 않았습니다. 입력을 다시 말씀해 주세요.", file=sys.stderr)
            record["error"] = str(exc)
            log_record(args.log_file, record)
            if iterator is not None:
                return 1
            continue
        log_record(args.log_file, record)
    if iterator is not None:
        print(json.dumps({"scenario": args.scenario, "final_action": last_action, "completed_cart_preview": last_action == "add_to_cart", "cart_preview": session.cart}, ensure_ascii=False, indent=2))
        return 0 if last_action == "add_to_cart" else 1
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n종료합니다.")
