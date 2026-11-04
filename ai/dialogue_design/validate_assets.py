"""Validate dialogue design data and inspect inputs; does not run an AI model."""

from __future__ import annotations

import argparse
import copy
import json
import subprocess
from collections import Counter
from pathlib import Path


ASSET_DIR = Path(__file__).resolve().parent
STATE_FIELDS = (
    "menu_id", "category", "temperature", "size", "quantity",
    "milk", "caffeine", "sweetness_preference",
)
NEXT_ACTIONS = {
    "ask_preference", "show_candidates", "ask_size", "ask_temperature",
    "ask_quantity", "ask_clarification", "present_confirmation", "add_to_cart",
    "cancelled", "no_match", "needs_catalog_review", "offer_help", "answer_menu_info",
}


def read_json(name: str) -> dict:
    return json.loads((ASSET_DIR / name).read_text(encoding="utf-8"))


def load_catalog(*, demo: bool = False) -> dict:
    catalog = read_json("menu_catalog.json")
    if demo:
        overlay = read_json("demo_attributes.json")
        by_id = {menu["id"]: menu for menu in catalog["menus"]}
        for override in overlay["overrides"]:
            if set(override) != {"id", "attributes", "sizes"}:
                raise ValueError("Demo overrides may only set attributes and sizes")
            by_id[override["id"]].update(copy.deepcopy(override))
        catalog["data_status"] = "demo_only"
        catalog["demo_notice"] = overlay["notice"]
    return catalog


def load_examples() -> list[dict]:
    path = ASSET_DIR / "utterance_examples.jsonl"
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def normalize_state(state: dict) -> dict:
    unknown = set(state) - set(STATE_FIELDS)
    if unknown:
        raise ValueError(f"Unknown state fields: {sorted(unknown)}")
    return {field: state.get(field) for field in STATE_FIELDS}


def apply_patch(state: dict, extraction: dict) -> dict:
    updated = normalize_state(state)
    for field in extraction["clear"]:
        updated[field] = None
    updated.update(extraction["set"])
    return updated


def filter_catalog(catalog: dict, state: dict) -> dict[str, list[int]]:
    """Separate matches, unknown attribute values and definite non-matches."""
    result: dict[str, list[int]] = {"eligible_ids": [], "undetermined_ids": [], "excluded_ids": []}
    for menu in catalog["menus"]:
        checks: list[bool | None] = []
        for field, value in (("menu_id", menu["id"]), ("category", menu["category"])):
            if state.get(field) is not None:
                checks.append(state[field] == value)
        if state.get("temperature") is not None:
            checks.append(state["temperature"] in menu["temperatures"])
        if state.get("size") is not None:
            checks.append(None if menu["sizes"] is None else state["size"] in menu["sizes"])
        for field in ("milk", "caffeine"):
            if state.get(field) is not None:
                value = menu["attributes"][field]
                checks.append(None if value is None else value == (state[field] == "with"))
        # Sweetness is a soft preference, not an exclusion rule. Quantity does not filter products.
        group = "excluded_ids" if False in checks else "undetermined_ids" if None in checks else "eligible_ids"
        result[group].append(menu["id"])
    return result


def check_slot_value(field: str, value: object, schema: dict) -> None:
    rule = schema["properties"]["set"]["properties"][field]
    if "enum" in rule and value not in rule["enum"]:
        raise ValueError(f"Invalid {field}: {value!r}")
    if rule.get("type") == "integer":
        if type(value) is not int or value < rule["minimum"] or value > rule.get("maximum", float("inf")):
            raise ValueError(f"Invalid {field}: {value!r}")


def validate_assets(*, check_backend: bool = False) -> dict:
    schema = read_json("extraction.schema.json")
    source = load_catalog()
    demo = load_catalog(demo=True)
    menus = source["menus"]
    menu_ids = {menu["id"] for menu in menus}
    if len(menu_ids) != len(menus):
        raise ValueError("Duplicate menu IDs")
    overlay_ids = [item["id"] for item in read_json("demo_attributes.json")["overrides"]]
    if len(set(overlay_ids)) != len(overlay_ids) or set(overlay_ids) != menu_ids:
        raise ValueError("Demo attributes must cover the source catalog exactly once")
    for catalog in (source, demo):
        for menu in catalog["menus"]:
            if menu["category"] not in {"coffee", "noncoffee", "frappe", "bakery"}:
                raise ValueError("Unknown menu category")
            if type(menu["price"]) is not int or menu["price"] < 0:
                raise ValueError("Invalid price")
            if not isinstance(menu["temperatures"], list) or not set(menu["temperatures"]) <= {"ICE", "HOT"}:
                raise ValueError("Invalid temperatures")
            for field in ("milk", "caffeine"):
                if menu["attributes"][field] is not None and type(menu["attributes"][field]) is not bool:
                    raise ValueError(f"Invalid menu attribute: {field}")
            if menu["attributes"]["sweetness"] not in {None, "unsweetened", "mild", "sweet"}:
                raise ValueError("Invalid sweetness attribute")
            if menu["sizes"] is not None and not set(menu["sizes"]) <= {"REGULAR", "LARGE"}:
                raise ValueError("Invalid sizes")

    examples = load_examples()
    seen = set()
    for case in examples:
        label = case["id"]
        if label in seen:
            raise ValueError(f"Duplicate example ID: {label}")
        seen.add(label)
        expected = case["expected"]
        if set(expected) != set(schema["required"]):
            raise ValueError(f"{label}: unexpected extraction keys")
        if expected["intent"] not in schema["properties"]["intent"]["enum"]:
            raise ValueError(f"{label}: invalid intent")
        if not set(expected["set"]) <= set(STATE_FIELDS) or not set(expected["clear"]) <= set(STATE_FIELDS):
            raise ValueError(f"{label}: unknown patch fields")
        if len(set(expected["clear"])) != len(expected["clear"]) or set(expected["clear"]) & set(expected["set"]):
            raise ValueError(f"{label}: duplicate/conflicting patch operations")
        for field, value in expected["set"].items():
            check_slot_value(field, value, schema)
            if field not in expected["evidence"]:
                raise ValueError(f"{label}: missing evidence for {field}")
        for evidence in expected["evidence"].values():
            if not isinstance(evidence, str) or not evidence or evidence not in case["utterance"]:
                raise ValueError(f"{label}: evidence is not in the utterance")
        clarification = expected["clarification"]
        if clarification is not None:
            rules = schema["properties"]["clarification"]["oneOf"][1]["properties"]
            if set(clarification) != {"reason", "fields"} or clarification["reason"] not in rules["reason"]["enum"]:
                raise ValueError(f"{label}: invalid clarification")
            if not clarification["fields"] or not set(clarification["fields"]) <= set(STATE_FIELDS):
                raise ValueError(f"{label}: invalid clarification fields")
        context = case["context"]
        for field, value in context["state"].items():
            if value is not None:
                check_slot_value(field, value, schema)
        after = apply_patch(context["state"], expected)
        if after["menu_id"] is not None and after["menu_id"] not in menu_ids:
            raise ValueError(f"{label}: nonexistent menu ID")
        if not set(context.get("candidate_ids", [])) <= menu_ids:
            raise ValueError(f"{label}: nonexistent candidate ID")
        if "expected_state_after" in case and after != normalize_state(case["expected_state_after"]):
            raise ValueError(f"{label}: state update differs from gold state")
        if case["catalog"] not in {"source", "demo"}:
            raise ValueError(f"{label}: unknown catalog")
        result = filter_catalog(demo if case["catalog"] == "demo" else source, after)
        for key, gold in case.get("expected_filter", {}).items():
            if result[key] != gold:
                raise ValueError(f"{label}: {key}: got {result[key]}, expected {gold}")
        if case["expected_next_action"] not in NEXT_ACTIONS:
            raise ValueError(f"{label}: unknown next action")
        if expected["intent"] == "confirm_selection" and not context.get("awaiting_confirmation", False):
            raise ValueError(f"{label}: confirmation without a pending confirmation")
        if case["expected_next_action"] == "add_to_cart":
            if expected["intent"] != "confirm_selection" or not context.get("awaiting_confirmation"):
                raise ValueError(f"{label}: cart action without explicit confirmation")
        if case["expected_next_action"] in {"present_confirmation", "add_to_cart"}:
            if after["menu_id"] is None or after["quantity"] is None or after["menu_id"] not in result["eligible_ids"]:
                raise ValueError(f"{label}: incomplete or invalid selection")
            selected = next(menu for menu in (demo if case["catalog"] == "demo" else source)["menus"] if menu["id"] == after["menu_id"])
            if selected["sizes"] is None:
                raise ValueError(f"{label}: size applicability is not verified")
            if selected["temperatures"] and after["temperature"] is None:
                raise ValueError(f"{label}: missing temperature")
            if selected["sizes"] and after["size"] is None:
                raise ValueError(f"{label}: missing size")

    story = [case for case in examples if case["group"] == "grandfather_discovery"]
    for previous, following in zip(story, story[1:]):
        if normalize_state(previous["expected_state_after"]) != normalize_state(following["context"]["state"]):
            raise ValueError(f"Scenario state does not continue from {previous['id']} to {following['id']}")

    if check_backend:
        backend_path = ASSET_DIR.parents[1] / "backend" / "src" / "data" / "menus.js"
        process = subprocess.run(
            ["node", "-e", "process.stdout.write(JSON.stringify(require(process.argv[1])))", str(backend_path)],
            check=True, capture_output=True, text=True, encoding="utf-8",
        )
        backend = json.loads(process.stdout)
        fields = source["field_status"]["backend_sourced"]
        if [{key: menu[key] for key in fields} for menu in menus] != backend:
            raise ValueError("Catalog snapshot differs from current backend menus; refresh the snapshot")
    covered_ids = sorted({case["expected"]["set"]["menu_id"] for case in examples if "menu_id" in case["expected"]["set"]})
    return {"menus": len(menus), "examples": len(examples), "groups": dict(Counter(case["group"] for case in examples)), "menu_ids_covered_by_selection": covered_ids, "backend_checked": check_backend}


SYSTEM_INSTRUCTION = """사용자 발화에서 메뉴 탐색·선택·수정 의도와 조건 변경분만 추출한다.
출력은 주어진 JSON Schema를 따르는 JSON 객체 하나다. set에서 생략한 필드는 기존 값을 유지하고 clear의 필드만 해제한다.
현재 발화에 없거나 문맥으로 확정되지 않은 값은 추측하지 않는다. set의 값마다 현재 발화의 근거 구절을 evidence에 적는다.
부정·수정을 반영하고 마지막 질문과 화면 후보 순서로 지시어를 해석한다. 근거 없는 '그래'를 주문 확정으로 처리하지 않는다.
우유·카페인·사이즈의 null은 미확인이다. 상품명이나 설명만으로 확인된 속성으로 바꾸지 않는다.
noncoffee는 판매 카테고리이며 무카페인을 의미하지 않는다. 덜 단 것은 선호다. 당 함량과 단맛 변경 가능 여부를 보장하지 않는다.
사용 가능한 메뉴 ID와 옵션만 참조한다. 모호한 메뉴·지원하지 않는 옵션은 clarification에 기록한다.
수정 발화가 있으면 다시 확인받아야 하며 confirm_selection은 awaiting_confirmation이 true이고 수정 없는 확정 응답일 때만 쓴다.
데모 속성은 대화 설계 검증용이다. 출력은 제안이며 실제 장바구니·결제 동작을 수행하지 않는다."""


def build_messages(case: dict) -> list[dict[str, str]]:
    catalog = load_catalog(demo=case["catalog"] == "demo")
    return [
        {"role": "system", "content": json.dumps({"instruction": SYSTEM_INSTRUCTION, "output_schema": read_json("extraction.schema.json")}, ensure_ascii=False)},
        {"role": "user", "content": json.dumps({"catalog_status": catalog["data_status"], "menus": catalog["menus"], "dialogue_context": case["context"], "utterance": case["utterance"]}, ensure_ascii=False)},
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-backend", action="store_true", help="Also compare the source snapshot with the backend using Node.js")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--show-prompt", metavar="EXAMPLE_ID", help="Print the model input only, without gold answers")
    group.add_argument("--query-example", metavar="EXAMPLE_ID", help="Apply a GOLD annotation and show the deterministic filter result; no model inference")
    args = parser.parse_args()
    summary = validate_assets(check_backend=args.check_backend)
    example_id = args.show_prompt or args.query_example
    if example_id:
        case = next((item for item in load_examples() if item["id"] == example_id), None)
        if case is None:
            parser.error(f"Unknown example: {example_id}")
        if args.show_prompt:
            output = build_messages(case)
        else:
            state = apply_patch(case["context"]["state"], case["expected"])
            output = {"example": example_id, "annotation_source": "handwritten_gold_not_model_output", "catalog": case["catalog"], "state_after": state, "filter": filter_catalog(load_catalog(demo=case["catalog"] == "demo"), state)}
    else:
        output = summary
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
