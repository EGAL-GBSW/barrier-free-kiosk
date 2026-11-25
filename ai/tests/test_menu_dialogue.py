"""메뉴 후보 축소와 민감한 조건의 보수적 처리를 검증한다."""
import json
import os
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
import httpx

from voice_order import order_ai


def parsed(**kwargs):
    values = {"operations": [], "recommendations": [], "edit_requested": False, "clarification": None}
    values.update(kwargs)
    return order_ai.Interpretation(**values)


class MenuDialogueTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"MENU_API_URL": "", "BACKEND_BASE_URL": ""})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = Mock()
        self.order = order_ai.OrderAI(client=self.client)

    def send(self, text, conditions=None, **kwargs):
        response = parsed(search_conditions=conditions, **kwargs)
        self.client.responses.parse.return_value = SimpleNamespace(output_parsed=response)
        return self.order.handle_input(text)

    def test_preferences_accumulate_across_turns_and_candidates_are_spoken(self):
        result = self.send("커피 말고 달달한 음료", order_ai.SearchConditions(
            exclude_category="coffee", kind="drink", taste="sweet"))
        self.assertTrue(result["needs_clarification"])
        self.assertEqual(result["next_action"], "ask_clarification")
        self.assertEqual([item["menu"] for item in result["recommendations"]], ["딥 초코 프라페"])
        self.assertIn("딥 초코 프라페", result["message"])
        self.assertEqual(result["cart"], [])
        result = self.send("아니, 딸기 쪽으로 바꿀게요", order_ai.SearchConditions(taste="strawberry", replace_taste=True))
        self.assertEqual([item["menu"] for item in result["recommendations"]], ["리얼 딸기 밀크"])
        self.assertEqual(result["menu_preferences"]["exclude_categories"], ["coffee"])
        payload = json.loads(self.client.responses.parse.call_args.kwargs["input"])
        self.assertEqual(payload["state"]["menu_preferences"]["tastes"], ["sweet"])

    def test_explicit_change_can_replace_exclusion_and_reset(self):
        self.send("커피 말고", order_ai.SearchConditions(exclude_category="coffee"))
        result = self.send("아니 커피로", order_ai.SearchConditions(category="coffee"))
        self.assertNotIn("coffee", result["menu_preferences"].get("exclude_categories", []))
        self.assertTrue(all(item["category"] == "coffee" for item in result["recommendations"]))
        result = self.send("다시 처음부터", order_ai.SearchConditions(reset=True))
        self.assertEqual(result["menu_preferences"], {})

    def test_price_temperature_and_missing_attribute(self):
        result = self.send("오천 원 이하 따뜻한 음료", order_ai.SearchConditions(
            kind="drink", temperature="HOT", max_price=5000))
        self.assertTrue(result["recommendations"])
        for candidate in result["recommendations"]:
            menu = self.order.menus[candidate["menu"]]
            self.assertLessEqual(menu["price"], 5000)
            self.assertIn("HOT", menu["temperatures"])
        result = self.send("천 원 이하", order_ai.SearchConditions(max_price=1000))
        self.assertEqual(result["recommendations"], [])
        self.assertIn("등록된 정보", result["message"])

    def test_multiple_tastes_accumulate_without_forgetting_earlier_conditions(self):
        self.send("달달한 거", order_ai.SearchConditions(taste="sweet"))
        result = self.send("초코면 좋겠어요", order_ai.SearchConditions(taste="chocolate"))
        self.assertEqual(result["menu_preferences"]["tastes"], ["sweet", "chocolate"])
        self.assertEqual([item["menu"] for item in result["recommendations"]], ["딥 초코 프라페"])

    def test_specific_condition_can_be_removed_or_changed(self):
        self.send("오천원 이하 커피", order_ai.SearchConditions(category="coffee", max_price=5000))
        result = self.send("가격은 상관없어요", order_ai.SearchConditions(clear_fields=["max_price"]))
        self.assertNotIn("max_price", result["menu_preferences"])
        self.assertEqual(result["menu_preferences"]["category"], "coffee")
        result = self.send("아니 디저트로 바꿀게요", order_ai.SearchConditions(kind="bakery"))
        self.assertNotIn("category", result["menu_preferences"])
        self.assertTrue(all(item["category"] == "bakery" for item in result["recommendations"]))

    def test_unverified_caffeine_and_allergens_are_not_recommended(self):
        for text in ("카페인 없는 음료", "우유 없이 주세요", "우유 들어가나요", "알레르기 있는지 알려주세요"):
            with self.subTest(text=text):
                result = self.order.handle_input(text)
                self.assertIn("직원", result["message"])
                self.assertEqual(result["items"], [])
        self.client.responses.parse.assert_not_called()

    def test_known_constraints_filter_model_recommendations(self):
        self.send("커피 말고", order_ai.SearchConditions(exclude_category="coffee"))
        self.client.responses.parse.return_value = SimpleNamespace(output_parsed=parsed(
            recommendations=["아메리카노", "딥 초코 프라페"]))
        result = self.order.handle_input("다른 건요?")
        self.assertEqual([item["menu"] for item in result["recommendations"]], ["딥 초코 프라페"])

    def test_search_to_selection_and_checkout_keeps_existing_order_contract(self):
        self.send("커피 말고 달달한 음료", order_ai.SearchConditions(exclude_category="coffee", taste="sweet"))
        operation = order_ai.Operation(action="add", menu="딥 초코 프라페", quantity=1,
                                       temperature="ICE", size="Large", shots=0)
        self.client.responses.parse.return_value = SimpleNamespace(output_parsed=order_ai.Interpretation(
            operations=[operation], recommendations=[], edit_requested=False, clarification=None))
        result = self.order.handle_input("초코로 한 잔, 큰 사이즈 주세요")
        self.assertEqual(result["menu_preferences"], {})
        self.assertEqual(result["items"], [{"menuId": 6, "quantity": 1, "temperature": "ICE",
                                            "size": "Large", "shots": 0}])
        result = self.send("결제해 주세요", checkout="start")
        self.assertEqual(result["next_action"], "request_quote")
        self.assertEqual(result["items"][0]["menuId"], 6)

    def test_text_api_preserves_conditions_on_the_same_session(self):
        responses = [
            parsed(search_conditions=order_ai.SearchConditions(exclude_category="coffee", kind="drink")),
            parsed(search_conditions=order_ai.SearchConditions(taste="chocolate")),
            order_ai.Interpretation(operations=[order_ai.Operation(
                action="add", menu="딥 초코 프라페", quantity=1, temperature="ICE", size="Regular", shots=0)],
                recommendations=[], edit_requested=False, clarification=None),
            parsed(checkout="start"),
        ]
        self.client.responses.parse.side_effect = [SimpleNamespace(output_parsed=response) for response in responses]
        order_ai.sessions.clear()
        self.addCleanup(order_ai.sessions.clear)
        with patch.object(order_ai, "OrderAI", return_value=self.order), TestClient(order_ai.app) as client:
            results = []
            for text in ("커피 말고 음료", "초코로", "딥 초코 프라페 한 잔 보통", "결제해 주세요"):
                response = client.post("/ai/order/text", json={"session_id": "same-order", "text": text})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["status"], "success")
                results.append(response.json()["result"])
        self.assertEqual(results[1]["menu_preferences"]["exclude_categories"], ["coffee"])
        self.assertEqual(results[1]["recommendations"][0]["menu"], "딥 초코 프라페")
        self.assertEqual(results[-1]["next_action"], "request_quote")
        self.assertEqual(results[-1]["items"][0]["menuId"], 6)

    def test_taste_tags_come_from_current_description_not_stale_menu_id(self):
        menu = {"id": 6, "name": "딥 초코 프라페", "description": "진한 초콜릿 음료",
                "category": "frappe", "price": 5800, "temperatures": ["ICE"]}
        enriched = order_ai.enrich_menu(menu)
        self.assertIn("chocolate", enriched["taste_tags"])
        self.assertNotIn("sweet", enriched["taste_tags"])

    def test_backend_base_url_loads_current_menu_and_keeps_new_ids(self):
        menu = {"id": 71, "name": "딸기 밀크", "description": "달콤한 딸기 음료",
                "category": "noncoffee", "price": 4500, "temperatures": ["ICE"]}
        response = httpx.Response(200, json=[menu], request=httpx.Request("GET", "http://backend:3300/menus"))
        with patch.dict(os.environ, {"BACKEND_BASE_URL": "http://backend:3300/"}), \
             patch.object(order_ai.httpx, "get", return_value=response) as fetch:
            result = self.send("달달한 음료", order_ai.SearchConditions(taste="sweet"))
        fetch.assert_called_once_with("http://backend:3300/menus", timeout=5.0)
        self.assertEqual(result["catalog_source"], "backend")
        self.assertEqual(result["recommendations"][0]["menu"], "딸기 밀크")
        self.assertEqual(self.order.menus["딸기 밀크"]["id"], 71)

    def test_invalid_backend_base_url_fails_without_using_snapshot(self):
        with patch.dict(os.environ, {"BACKEND_BASE_URL": "file:///tmp/menus"}):
            result = self.send("음료 추천", order_ai.SearchConditions(kind="drink"))
        self.assertEqual(result["error"], "menu_unavailable")
        self.client.responses.parse.assert_not_called()

    def test_particle_matches_menu_name(self):
        self.assertEqual(order_ai.with_topic("딥 초코 프라페"), "딥 초코 프라페는")
        self.assertEqual(order_ai.with_topic("바스크 치즈케이크"), "바스크 치즈케이크는")
        self.assertEqual(order_ai.with_topic("리얼 딸기 밀크"), "리얼 딸기 밀크는")


if __name__ == "__main__":
    unittest.main()
