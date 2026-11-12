import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import text_dialogue
from dialogue_design import validate_assets as assets
from dialogue_design.conversation import Conversation, load_runtime_catalog
from dialogue_design.ollama_client import ModelError, OllamaClient, PredictionError, validate_prediction


def prediction(utterance, updates=None, *, intent="select_menu", clear=None, clarification=None, recommendations=None):
    updates = updates or {}
    return {"intent": intent, "set": updates, "clear": clear or [], "clarification": clarification,
            "evidence": {field: utterance for field in updates}, "recommendations": recommendations or []}


class ConversationTests(unittest.TestCase):
    def test_supplied_backend_menu_shape_is_loaded_without_invented_attributes(self):
        menu = {"id": 4, "name": "제주 말차 라떼", "price": 5200, "category": "noncoffee",
                "description": "제주 말차의 진한 풍미와 우유의 부드러움.", "badge": "BEST", "temperatures": ["ICE", "HOT"]}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "menus.json"
            path.write_text(json.dumps([menu], ensure_ascii=False), encoding="utf-8")
            catalog = load_runtime_catalog(menu_file=path)
        actual = catalog["menus"][0]
        for key, value in menu.items():
            self.assertEqual(actual[key], value)
        self.assertIsNone(actual["attributes"]["milk"])
        self.assertIsNone(actual["attributes"]["caffeine"])
        self.assertIsNone(actual["sizes"])

    def test_registered_menu_order_completes_without_making_up_sizes(self):
        session = Conversation(load_runtime_catalog())
        text = "따뜻한 제주 말차 라떼 한 잔 주세요."
        result = session.handle_prediction(text, prediction(text, {"menu_id": 4, "temperature": "HOT", "quantity": 1}))
        self.assertEqual(result["action"], "present_confirmation")
        self.assertNotIn("사이즈", result["reply"])
        self.assertIsNone(result["state"]["size"])
        self.assertEqual(session.cart, [])
        result = session.handle_prediction("응", prediction("응", intent="confirm_selection"))
        self.assertEqual(result["action"], "add_to_cart")
        self.assertEqual(session.cart[0]["menu_id"], 4)
        self.assertEqual(session.cart[0]["base_total_krw"], 5200)
        self.assertTrue(session.cart[0]["preview_only"])

    def test_unknown_size_request_is_held_until_condition_is_cleared(self):
        session = Conversation(load_runtime_catalog())
        text = "아이스 아메리카노 큰 거 한 잔"
        result = session.handle_prediction(text, prediction(text, {"menu_id": 1, "temperature": "ICE", "size": "LARGE", "quantity": 1}))
        self.assertEqual(result["action"], "needs_catalog_review")
        self.assertFalse(session.awaiting_confirmation)
        self.assertEqual(session.cart, [])
        result = session.handle_prediction("크기 조건 취소", prediction("크기 조건 취소", intent="update_selection", clear=["size"]))
        self.assertEqual(result["action"], "present_confirmation")
        self.assertEqual(result["state"]["temperature"], "ICE")
        self.assertEqual(result["state"]["quantity"], 1)

    def test_grandfather_demo_runs_six_turns_and_preserves_context(self):
        session = Conversation(load_runtime_catalog(demo=True))
        actions = []
        cases = [case for case in assets.load_examples() if case["group"] == "grandfather_discovery"]
        for case in cases:
            self.assertEqual(session.state, assets.normalize_state(case["context"]["state"]))
            actual = copy.deepcopy(case["expected"])
            actual["recommendations"] = []
            actions.append(session.handle_prediction(case["utterance"], actual)["action"])
        self.assertEqual(actions, ["ask_preference", "ask_preference", "show_candidates", "ask_size", "present_confirmation", "add_to_cart"])
        self.assertEqual(session.cart[0]["temperature"], "ICE")
        self.assertEqual(session.cart[0]["size"], "LARGE")
        self.assertEqual(session.cart[0]["quantity"], 1)

    def test_hot_strawberry_milk_needs_a_supported_temperature(self):
        session = Conversation(load_runtime_catalog())
        text = "따뜻한 딸기우유 하나"
        result = session.handle_prediction(text, prediction(text, {"menu_id": 5, "temperature": "HOT", "quantity": 1}))
        self.assertEqual(result["action"], "ask_clarification")
        self.assertEqual(session.last_question["yes_value"], "ICE")
        result = session.handle_prediction("응", prediction("응", {"temperature": "ICE"}, intent="update_selection"))
        self.assertEqual(result["action"], "present_confirmation")
        self.assertEqual(result["state"]["menu_id"], 5)

    def test_recommendations_cannot_bypass_category_or_temperature_filters(self):
        session = Conversation(load_runtime_catalog())
        text = "따뜻한 말차 같은 음료 한 잔"
        rec = [{"menu_id": 6, "description_quote": "진한 초콜릿"}]
        result = session.handle_prediction(text, prediction(text, {"category": "noncoffee", "temperature": "HOT", "quantity": 1}, intent="discover_menu", recommendations=rec))
        self.assertEqual(result["candidate_ids"], [4])
        self.assertEqual(result["recommendations"], [])

    def test_caffeine_question_does_not_make_noncoffee_caffeine_free(self):
        session = Conversation(load_runtime_catalog())
        session.state["menu_id"] = 4
        text = "이거 카페인 없는 거야?"
        result = session.handle_prediction(text, prediction(text, intent="ask_menu_info"))
        self.assertIn("등록되어 있지", result["reply"])
        self.assertIsNone(result["state"]["caffeine"])
        self.assertFalse(result["awaiting_confirmation"])

    def test_confirmation_after_a_quantity_change_is_required_again(self):
        session = Conversation(load_runtime_catalog())
        text = "아이스 아메리카노 한 잔"
        session.handle_prediction(text, prediction(text, {"menu_id": 1, "temperature": "ICE", "quantity": 1}))
        text = "아니 두 잔"
        result = session.handle_prediction(text, prediction(text, {"quantity": 2}, intent="update_selection"))
        self.assertEqual(result["action"], "present_confirmation")
        self.assertEqual(session.cart, [])
        session.handle_prediction("담아 줘", prediction("담아 줘", intent="confirm_selection"))
        self.assertEqual(session.cart[0]["quantity"], 2)

    def test_invalid_model_output_leaves_selection_unchanged(self):
        session = Conversation(load_runtime_catalog())
        session.state["quantity"] = 1
        before = copy.deepcopy(session.state)
        with self.assertRaises(PredictionError):
            session.handle_prediction("아무거나", prediction("아무거나", {"menu_id": 999, "quantity": 2}))
        self.assertEqual(session.state, before)
        with self.assertRaises(PredictionError):
            session.handle_prediction("응", prediction("응", intent="confirm_selection"))
        self.assertEqual(session.cart, [])

    def test_negative_response_cannot_be_misclassified_as_confirmation(self):
        session = Conversation(load_runtime_catalog())
        text = "아이스 아메리카노 한 잔"
        session.handle_prediction(text, prediction(text, {"menu_id": 1, "temperature": "ICE", "quantity": 1}))
        with self.assertRaises(PredictionError):
            session.handle_prediction("아니 담지 마", prediction("아니 담지 마", intent="confirm_selection"))
        self.assertEqual(session.cart, [])

    def test_request_failure_revokes_old_confirmation_without_losing_selection(self):
        session = Conversation(load_runtime_catalog())
        text = "아이스 아메리카노 한 잔"
        session.handle_prediction(text, prediction(text, {"menu_id": 1, "temperature": "ICE", "quantity": 1}))
        client = Mock()
        client.extract.side_effect = ModelError("timeout")
        with self.assertRaises(ModelError):
            text_dialogue.run_turn(client, session, "두 잔으로 바꿔")
        self.assertFalse(session.awaiting_confirmation)
        self.assertEqual(session.state["quantity"], 1)
        self.assertEqual(session.cart, [])


class OllamaClientTests(unittest.TestCase):
    def test_request_uses_local_structured_api_and_never_sends_gold(self):
        catalog = load_runtime_catalog()
        text = "말차라떼 한 잔"
        answer = prediction(text, {"menu_id": 4, "quantity": 1})
        payload = {"done": True, "message": {"content": json.dumps(answer, ensure_ascii=False)}, "load_duration": 1000000}
        response = Mock()
        response.__enter__ = Mock(return_value=io.BytesIO(json.dumps(payload).encode()))
        response.__exit__ = Mock(return_value=False)
        with patch("dialogue_design.ollama_client.urlopen", return_value=response) as opening:
            actual, metrics = OllamaClient(retries=0).extract(catalog, {"state": {}}, text)
        request = opening.call_args.args[0]
        body = json.loads(request.data)
        self.assertEqual(request.full_url, "http://127.0.0.1:11434/api/chat")
        self.assertFalse(body["stream"])
        self.assertIsInstance(body["format"], dict)
        self.assertEqual(body["options"]["num_ctx"], 8192)
        model_input = json.loads(body["messages"][1]["content"])
        self.assertNotIn("expected", model_input)
        self.assertEqual(actual["set"]["menu_id"], 4)
        self.assertEqual(metrics["attempts"], 1)

    def test_invalid_json_is_repaired_once_without_mutating_context(self):
        catalog = load_runtime_catalog()
        text = "아메리카노"
        answer = prediction(text, {"menu_id": 1})
        context = {"state": {"quantity": 2}}
        client = OllamaClient(retries=1)
        with patch.object(client, "_request", side_effect=[{"message": {"content": "{}"}}, {"message": {"content": json.dumps(answer)}}]) as request:
            actual, metrics = client.extract(catalog, context, text)
        self.assertEqual(metrics["attempts"], 2)
        self.assertEqual(actual, answer)
        self.assertEqual(context, {"state": {"quantity": 2}})
        self.assertIn("이전 JSON", request.call_args.args[1]["messages"][-1]["content"])

    def test_fabricated_description_quote_and_boolean_quantity_are_rejected(self):
        catalog = load_runtime_catalog()
        text = "카페인 없는 커피"
        answer = prediction(text, recommendations=[{"menu_id": 1, "description_quote": "카페인 전혀 없음"}])
        with self.assertRaises(PredictionError):
            validate_prediction(answer, catalog, {}, text)
        with self.assertRaises(PredictionError):
            validate_prediction(prediction(text, {"quantity": True}), catalog, {}, text)


if __name__ == "__main__":
    unittest.main()
