"""Text dialogue policy and local cart preview over the registered menu fields."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

from dialogue_design import validate_assets as assets
from dialogue_design.ollama_client import validate_prediction


CATEGORY_LABELS = {"coffee": "커피", "noncoffee": "말차·딸기우유 같은 음료", "frappe": "프라페", "bakery": "빵·케이크"}
TEMPERATURE_LABELS = {"ICE": "아이스", "HOT": "따뜻한"}
SIZE_LABELS = {"REGULAR": "보통", "LARGE": "큰"}


def load_runtime_catalog(*, menu_file: Path | None = None, menu_url: str | None = None, demo: bool = False) -> dict:
    if sum((menu_file is not None, menu_url is not None, demo)) > 1:
        raise ValueError("--menu-file, --menu-url, --demo 중 하나만 사용하세요.")
    if demo or (menu_file is None and menu_url is None):
        raw = assets.load_catalog(demo=demo)
    elif menu_file is not None:
        raw = json.loads(menu_file.read_text(encoding="utf-8-sig"))
    else:
        try:
            with urlopen(menu_url, timeout=10) as response:
                raw = json.loads(response.read().decode("utf-8-sig"))
        except (URLError, TimeoutError) as exc:
            raise ValueError(f"메뉴 API를 읽을 수 없습니다: {exc}") from exc
    items = raw if isinstance(raw, list) else raw.get("menus") if isinstance(raw, dict) else None
    if not isinstance(items, list) or not items:
        raise ValueError("메뉴 JSON은 메뉴 배열 또는 menus 배열을 가진 객체여야 합니다. JavaScript 코드를 넣지 마세요.")
    menus, seen = [], set()
    for item in items:
        if not isinstance(item, dict) or not {"id", "name", "price", "category", "temperatures"} <= item.keys():
            raise ValueError("각 메뉴에 id, name, price, category, temperatures가 필요합니다.")
        if type(item["id"]) is not int or item["id"] < 1 or item["id"] in seen:
            raise ValueError("메뉴 ID는 중복 없는 양의 정수여야 합니다.")
        if not isinstance(item["name"], str) or not item["name"].strip() or type(item["price"]) is not int or item["price"] < 0:
            raise ValueError("메뉴 이름 또는 가격이 올바르지 않습니다.")
        if not isinstance(item["category"], str) or item["category"] not in CATEGORY_LABELS:
            raise ValueError(f"지원하지 않는 category: {item['category']}")
        if not isinstance(item["temperatures"], list) or any(not isinstance(value, str) or value not in TEMPERATURE_LABELS for value in item["temperatures"]):
            raise ValueError("temperatures에는 ICE/HOT만 사용할 수 있습니다.")
        menu = copy.deepcopy(item)
        menu.setdefault("description", "")
        menu.setdefault("badge", None)
        menu.setdefault("aliases", [])
        menu.setdefault("attributes", {})
        if not isinstance(menu["description"], str) or not isinstance(menu["aliases"], list) or any(not isinstance(alias, str) for alias in menu["aliases"]):
            raise ValueError("메뉴 description 또는 aliases 형식이 올바르지 않습니다.")
        if not isinstance(menu["attributes"], dict):
            raise ValueError("attributes는 객체여야 합니다.")
        for field in ("milk", "caffeine", "sweetness"):
            menu["attributes"].setdefault(field, None)
        for field in ("milk", "caffeine"):
            if menu["attributes"][field] is not None and type(menu["attributes"][field]) is not bool:
                raise ValueError(f"attributes.{field}는 true/false/null이어야 합니다.")
        if menu["attributes"]["sweetness"] not in (None, "unsweetened", "mild", "sweet"):
            raise ValueError("sweetness 값이 올바르지 않습니다.")
        menu.setdefault("sizes", None)
        if menu["sizes"] is not None and (not isinstance(menu["sizes"], list) or any(not isinstance(value, str) or value not in SIZE_LABELS for value in menu["sizes"])):
            raise ValueError("이 프로토타입의 sizes는 REGULAR/LARGE 배열 또는 null이어야 합니다.")
        menu.setdefault("option_price_deltas", None)
        menu.setdefault("availability", None)
        seen.add(menu["id"])
        menus.append(menu)
    return {"data_status": raw.get("data_status", "backend_fields_only") if isinstance(raw, dict) else "backend_fields_only", "menus": menus}


class Conversation:
    """One session. State mutations occur only after validated model output."""

    def __init__(self, catalog: dict):
        self.catalog = copy.deepcopy(catalog)
        self.by_id = {menu["id"]: menu for menu in catalog["menus"]}
        self.cart: list[dict] = []
        self.reset()

    def reset(self) -> None:
        self.state = assets.normalize_state({})
        self.last_question: dict = {}
        self.candidate_ids: list[int] = []
        self.awaiting_confirmation = False
        self.recent_turns: list[dict] = []

    def context(self) -> dict:
        return copy.deepcopy({"state": self.state, "last_question": self.last_question, "candidate_ids": self.candidate_ids, "awaiting_confirmation": self.awaiting_confirmation, "recent_turns": self.recent_turns[-6:]})

    def abandon_confirmation(self) -> None:
        self.awaiting_confirmation = False
        self.last_question = {"text": "입력을 다시 말씀해 주세요. 현재 선택은 아직 확정되지 않았어요."}

    def _reply(self, utterance: str, prediction: dict, action: str, reply: str, *, question: dict | None = None, candidates: list[int] | None = None, confirm: bool = False, recommendations: list[dict] | None = None) -> dict:
        self.last_question = question or {}
        self.candidate_ids = list(candidates or [])
        self.awaiting_confirmation = confirm
        self.recent_turns.append({"user": utterance, "assistant": reply})
        self.recent_turns = self.recent_turns[-6:]
        return {"action": action, "reply": reply, "extraction": copy.deepcopy(prediction), "state": copy.deepcopy(self.state), "filter": assets.filter_catalog(self.catalog, self.state), "candidate_ids": list(self.candidate_ids), "recommendations": recommendations or [], "awaiting_confirmation": confirm, "cart_preview": copy.deepcopy(self.cart)}

    def _summary(self) -> str:
        menu = self.by_id[self.state["menu_id"]]
        parts = []
        if self.state["temperature"]:
            parts.append(TEMPERATURE_LABELS[self.state["temperature"]])
        parts.append(menu["name"])
        if self.state["size"]:
            parts.append(SIZE_LABELS[self.state["size"]] + " 사이즈")
        unit = "개" if menu["category"] == "bakery" else "잔"
        parts.append(f"{self.state['quantity']}{unit}")
        return " ".join(parts)

    def _rank(self, ids: list[int], recommendations: list[dict]) -> list[int]:
        order = {item["menu_id"]: index for index, item in enumerate(recommendations)}
        preference = self.state["sweetness_preference"]

        def score(menu_id: int) -> tuple:
            sweetness = self.by_id[menu_id]["attributes"]["sweetness"]
            preferred = (preference == "less_sweet" and sweetness in ("unsweetened", "mild")) or (preference == "sweet" and sweetness == "sweet")
            return (0 if preferred else 1, order.get(menu_id, len(order)), menu_id)

        return sorted(ids, key=score)

    def _info(self, utterance: str) -> str:
        menu_id = self.state["menu_id"]
        if menu_id is None:
            return "어떤 메뉴에 대해 궁금하세요? 메뉴 이름을 말씀해 주세요."
        menu = self.by_id[menu_id]
        if "카페인" in utterance:
            value = menu["attributes"]["caffeine"]
            if value is None:
                return f"{menu['name']}의 카페인 포함 여부는 등록되어 있지 않아요. 커피가 아닌 음료 분류만으로 무카페인이라고 판단할 수 없어요."
            return f"등록된 {'데모 ' if self.catalog['data_status'] == 'demo_only' else ''}정보상 {menu['name']}에는 카페인이 {'있어요' if value else '없어요'}."
        if "우유" in utterance:
            value = menu["attributes"]["milk"]
            if value is None:
                return f"{menu['name']}의 등록 설명은 ‘{menu['description']}’예요. 별도로 확인된 우유 포함 속성은 아직 없어요."
            return f"등록된 {'데모 ' if self.catalog['data_status'] == 'demo_only' else ''}정보상 우유가 {'포함되어 있어요' if value else '포함되어 있지 않아요'}."
        if any(word in utterance for word in ("가격", "얼마", "금액")):
            return f"{menu['name']}의 등록 기본 가격은 {menu['price']:,}원이에요. 옵션 추가금은 별도 확인이 필요해요."
        return f"{menu['name']}: {menu['description']} 기본 가격은 {menu['price']:,}원이에요."

    def handle_prediction(self, utterance: str, prediction: dict) -> dict:
        validate_prediction(prediction, self.catalog, self.context(), utterance)
        was_pending = self.awaiting_confirmation
        before_menu = self.state["menu_id"]
        self.state = assets.apply_patch(self.state, prediction)
        self.awaiting_confirmation = False
        intent = prediction["intent"]
        if intent == "cancel_selection":
            self.reset()
            return self._reply(utterance, prediction, "cancelled", "현재 고르던 메뉴를 취소했어요. 어떤 걸 드시고 싶으세요?")
        # An explicitly selected new product resets an obsolete category, not user ingredient constraints.
        if self.state["menu_id"] is not None and self.state["menu_id"] != before_menu:
            menu = self.by_id[self.state["menu_id"]]
            if "category" not in prediction["set"] and self.state["category"] != menu["category"]:
                self.state["category"] = None
            if menu["category"] == "bakery":
                for field in ("temperature", "size"):
                    if field not in prediction["set"]:
                        self.state[field] = None
        if intent == "ask_menu_info":
            return self._reply(utterance, prediction, "answer_menu_info", self._info(utterance), candidates=self.candidate_ids)

        clarification = prediction["clarification"]
        if clarification:
            field = clarification["fields"][0]
            menu = self.by_id.get(self.state["menu_id"])
            if field == "temperature" and menu:
                allowed = menu["temperatures"]
                choices = " 또는 ".join(TEMPERATURE_LABELS[value] for value in allowed)
                text = f"{menu['name']}의 등록된 온도는 {choices or '선택 없음'}예요. 원하시는 온도를 다시 말씀해 주세요."
                question = {"slot": "temperature", "choices": allowed, "text": text}
                if len(allowed) == 1:
                    text = f"{menu['name']}는 {choices}로만 등록되어 있어요. {choices}로 바꿀까요?"
                    question.update(text=text, yes_value=allowed[0])
            elif field == "size":
                choices = menu["sizes"] if menu else None
                text = "사이즈가 등록되어 있지 않아요. 크기 조건을 취소하거나 메뉴 정보를 확인해 주세요." if choices is None else f"등록된 크기는 {', '.join(SIZE_LABELS[value] for value in choices)}예요. 다시 선택해 주세요."
                question = {"slot": "size", "text": text, "choices": choices or []}
            else:
                text = "메뉴나 선택 내용을 확실히 알지 못했어요. 메뉴 이름 또는 원하시는 조건을 다시 말씀해 주세요."
                question = {"slot": field, "text": text}
            return self._reply(utterance, prediction, "ask_clarification", text, question=question)

        result = assets.filter_catalog(self.catalog, self.state)
        eligible = result["eligible_ids"]
        if not eligible:
            if result["undetermined_ids"]:
                names = ", ".join(self.by_id[value]["name"] for value in result["undetermined_ids"])
                text = f"{names}의 요청하신 성분 또는 사이즈 정보가 미확인이에요. 맞는다고 확정할 수 없어요. 해당 조건을 취소하거나 메뉴 정보를 확인해 주세요."
                return self._reply(utterance, prediction, "needs_catalog_review", text)
            menu = self.by_id.get(self.state["menu_id"])
            if menu and self.state["temperature"] and self.state["temperature"] not in menu["temperatures"]:
                allowed = menu["temperatures"]
                if len(allowed) == 1:
                    text = f"{menu['name']}는 {TEMPERATURE_LABELS[allowed[0]]}로만 등록되어 있어요. 이 온도로 바꿀까요?"
                    return self._reply(utterance, prediction, "ask_clarification", text, question={"slot": "temperature", "yes_value": allowed[0], "text": text})
            return self._reply(utterance, prediction, "no_match", "현재 조건을 모두 만족하는 등록 메뉴가 없어요. 어떤 조건을 바꿀까요?")

        if self.state["menu_id"] is None:
            categories = list(dict.fromkeys(self.by_id[value]["category"] for value in eligible))
            if self.state["category"] is None and len(categories) > 1:
                text = "어떤 종류가 좋으세요? " + ", ".join(CATEGORY_LABELS[value] for value in categories) + "가 있어요."
                return self._reply(utterance, prediction, "ask_preference", text, question={"slot": "category", "choices": categories, "text": text})
            milk_values = [self.by_id[value]["attributes"]["milk"] for value in eligible]
            if len(eligible) > 1 and self.state["milk"] is None and None not in milk_values and len(set(milk_values)) > 1:
                text = "우유를 넣은 커피와 우유 없는 커피 중 어느 쪽이 좋으세요?"
                return self._reply(utterance, prediction, "ask_preference", text, question={"slot": "milk", "choices": ["with", "without"], "text": text})
            ranked = self._rank(eligible, prediction["recommendations"])
            displayed = ranked[:3]
            shown_recommendations = [item for item in prediction["recommendations"] if item["menu_id"] in displayed]
            lines = [f"{index}. {self.by_id[value]['name']} — {self.by_id[value]['description']}" for index, value in enumerate(displayed, 1)]
            text = "조건에 맞는 후보예요.\n" + "\n".join(lines) + "\n어떤 메뉴로 드릴까요?"
            if self.state["sweetness_preference"] and any(self.by_id[value]["attributes"]["sweetness"] is None for value in displayed):
                text += " 단맛 정도는 확인된 속성이 없어 설명을 참고해 골라 주세요."
            question = {"slot": "menu_id", "text": text}
            if len(displayed) == 1:
                text += " 이 메뉴로 선택할까요?"
                question.update(text=text, yes_value=displayed[0])
            return self._reply(utterance, prediction, "show_candidates", text, question=question, candidates=displayed, recommendations=shown_recommendations)

        menu = self.by_id[self.state["menu_id"]]
        if self.state["quantity"] is None:
            text = "몇 개로 드릴까요?" if menu["category"] == "bakery" else "몇 잔으로 드릴까요?"
            return self._reply(utterance, prediction, "ask_quantity", text, question={"slot": "quantity", "text": text})
        if menu["temperatures"] and self.state["temperature"] is None:
            allowed = menu["temperatures"]
            text = f"{menu['name']}는 {', '.join(TEMPERATURE_LABELS[value] for value in allowed)}가 있어요. 어떤 온도로 드릴까요?"
            question = {"slot": "temperature", "choices": allowed, "text": text}
            if len(allowed) == 1:
                text = f"{menu['name']}는 {TEMPERATURE_LABELS[allowed[0]]}로만 등록되어 있어요. 괜찮으세요?"
                question.update(text=text, yes_value=allowed[0])
            return self._reply(utterance, prediction, "ask_temperature", text, question=question)
        if menu["sizes"] and self.state["size"] is None:
            text = "크기는 " + ", ".join(SIZE_LABELS[value] for value in menu["sizes"]) + " 중 어떤 걸로 드릴까요?"
            return self._reply(utterance, prediction, "ask_size", text, question={"slot": "size", "choices": menu["sizes"], "text": text})
        if intent == "confirm_selection" and was_pending:
            summary = self._summary()
            self.cart.append({"menu_id": menu["id"], "name": menu["name"], "temperature": self.state["temperature"], "size": self.state["size"], "quantity": self.state["quantity"], "base_total_krw": menu["price"] * self.state["quantity"], "price_is_base_only": True, "preview_only": True})
            self.reset()
            return self._reply(utterance, prediction, "add_to_cart", f"{summary}을 테스트 장바구니에 담았어요. 추가로 드실 메뉴가 있으면 말씀해 주세요.")
        text = self._summary() + "이에요. 이 구성으로 테스트 장바구니에 담을까요?"
        return self._reply(utterance, prediction, "present_confirmation", text, question={"text": text}, confirm=True)
