"""평가용 OpenAI 응답 검증. 실제 네트워크 또는 API 키를 사용하지 않는다."""

import json
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from webspeech_eval import analyzer
from voice_order import order_ai


def assessment(**updates):
    data = {
        "decision": "ready_to_confirm",
        "question": None,
        "reason": "메뉴와 수량, 온도가 명확합니다.",
        "items": [{"menu_id": 1, "menu_name": "아메리카노", "quantity": 2,
                   "temperature": "ICE", "action": "add"}],
    }
    data.update(updates)
    return analyzer.EvaluationAnalysis.model_validate(data)


class WebSpeechAnalyzerTests(unittest.TestCase):
    def test_valid_candidate_is_not_an_actual_order(self):
        result = analyzer._checked_result(assessment())
        self.assertEqual(result["decision"], "ready_to_confirm")
        self.assertEqual(result["items"][0]["quantity"], 2)

    def test_missing_temperature_and_unknown_menu_are_not_ready(self):
        for item in (
            {"menu_id": 1, "menu_name": "아메리카노", "quantity": 1,
             "temperature": None, "action": "add"},
            {"menu_id": 999, "menu_name": "없는 메뉴", "quantity": 1,
             "temperature": "HOT", "action": "add"},
            {"menu_id": 1, "menu_name": "아메리카노", "quantity": 1,
             "temperature": "HOT", "action": "remove"},
            {"menu_id": 1, "menu_name": "카페 라떼", "quantity": 1,
             "temperature": "HOT", "action": "add"},
            {"menu_id": 1, "menu_name": "아메리카노", "quantity": 0,
             "temperature": "HOT", "action": "add"},
            {"menu_id": 1, "menu_name": "아메리카노", "quantity": 100,
             "temperature": "HOT", "action": "add"},
        ):
            with self.subTest(item=item):
                result = analyzer._checked_result(assessment(items=[item]))
                self.assertEqual(result["decision"], "undetermined")

    def test_question_missing_cannot_be_reported_as_clarification(self):
        result = analyzer._checked_result(assessment(decision="ask_clarification", question=" "))
        self.assertEqual(result["decision"], "undetermined")
        result = analyzer._checked_result(assessment(decision="ask_clarification", question="아이스로 드릴까요?"))
        self.assertEqual(result["decision"], "ask_clarification")

    def test_stt_text_sent_to_existing_configured_model_without_answer_label(self):
        fake_parse = MagicMock(return_value=SimpleNamespace(output_parsed=assessment()))
        fake_order = SimpleNamespace(client=SimpleNamespace(responses=SimpleNamespace(parse=fake_parse)),
                                     model="existing-model")
        with patch.object(analyzer, "OrderAI", return_value=fake_order):
            result = analyzer.analyze_transcript("아이스 아메리카노 두 잔")
        payload = fake_parse.call_args.kwargs
        self.assertEqual(payload["model"], "existing-model")
        self.assertEqual(json.loads(payload["input"])["utterance"], "아이스 아메리카노 두 잔")
        self.assertNotIn("reference", json.loads(payload["input"]))
        self.assertEqual(result["decision"], "ready_to_confirm")

    def test_empty_text_rejected_before_openai(self):
        with patch.object(analyzer, "OrderAI") as order:
            with self.assertRaises(ValueError):
                analyzer.analyze_transcript("  ")
        order.assert_not_called()

    def test_remote_evaluation_endpoint_does_not_create_an_order_session(self):
        order_ai.sessions.clear()
        fake_result = analyzer._checked_result(assessment())
        with patch.object(analyzer, "analyze_transcript", return_value=fake_result) as model:
            with TestClient(order_ai.app) as client:
                response = client.post("/ai/evaluate/text", json={"transcript": "아메리카노"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["analysis"]["decision"], "ready_to_confirm")
        self.assertEqual(order_ai.sessions, {})
        model.assert_called_once_with("아메리카노")


if __name__ == "__main__":
    unittest.main()
