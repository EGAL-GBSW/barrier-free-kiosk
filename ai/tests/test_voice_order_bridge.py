"""Exercise the STT/order bridge without a GPU, API key, or network access."""

import importlib.util
import json
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch

import httpx
from fastapi.testclient import TestClient


# The network bridge does not require a real OpenAI SDK or a secret in tests.
# Give the existing order module the names it imports, then replace OrderAI with
# a small stateful fake below. No SDK methods or API calls are exercised here.
sdk = types.ModuleType("openai")
sdk.OpenAI = type("OpenAI", (), {})
sdk.OpenAIError = type("OpenAIError", (Exception,), {})
dotenv = types.ModuleType("dotenv")
dotenv.load_dotenv = lambda *args, **kwargs: False
module_path = Path(__file__).resolve().parents[1] / "voice_order" / "order_ai.py"
spec = importlib.util.spec_from_file_location("voice_order_bridge_test_module", module_path)
order_module = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {"openai": sdk, "dotenv": dotenv}):
    spec.loader.exec_module(order_module)
RealOrderAI = order_module.OrderAI


class FakeOrderAI:
    def __init__(self):
        self.turns = []

    def handle_input(self, text):
        self.turns.append(text)
        return {
            "message": "어떤 메뉴로 드릴까요?" if len(self.turns) == 1 else "주문을 확인해 주세요.",
            "cart": [],
            "recommendations": [],
            "screen": "menu",
            "error": None,
        }


class VoiceOrderBridgeTests(unittest.TestCase):
    def setUp(self):
        order_module.sessions.clear()
        self.addCleanup(order_module.sessions.clear)
        self.env = patch.dict(os.environ, {"STT_API_URL": "http://stt.internal:8001/transcribe"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.factory = patch.object(order_module, "OrderAI", FakeOrderAI)
        self.factory.start()
        self.addCleanup(self.factory.stop)
        self.stt = patch.object(order_module.httpx, "post")
        self.post = self.stt.start()
        self.addCleanup(self.stt.stop)
        self.client = TestClient(order_module.app)
        self.addCleanup(self.client.close)

    @staticmethod
    def stt_response(text, status=200):
        return httpx.Response(
            status,
            json={"transcript": text},
            request=httpx.Request("POST", "http://stt.internal:8001/transcribe"),
        )

    def send_audio(self, session_id="session-1", filename="turn.webm", content=b"test-audio"):
        return self.client.post(
            "/ai/order/audio",
            data={"session_id": session_id},
            files={"audio": (filename, content, "audio/webm")},
        )

    def test_requestion_answer_reuses_order_session_and_forwards_transcripts(self):
        self.post.side_effect = [self.stt_response("따뜻한 커피요"), self.stt_response("카페 라떼요")]
        first = self.send_audio()
        second = self.send_audio()

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json()["recognized_text"], "따뜻한 커피요")
        self.assertEqual(second.json()["recognized_text"], "카페 라떼요")
        self.assertEqual(first.json()["result"]["message"], "어떤 메뉴로 드릴까요?")
        self.assertEqual(order_module.sessions["session-1"].turns, ["따뜻한 커피요", "카페 라떼요"])
        self.assertEqual(self.post.call_count, 2)
        self.assertEqual(self.post.call_args_list[0].args[0], "http://stt.internal:8001/transcribe")

    def test_different_sessions_do_not_share_dialogue_history(self):
        self.post.side_effect = [self.stt_response("첫 번째"), self.stt_response("두 번째")]
        self.assertEqual(self.send_audio("first").status_code, 200)
        self.assertEqual(self.send_audio("second").status_code, 200)
        self.assertEqual(order_module.sessions["first"].turns, ["첫 번째"])
        self.assertEqual(order_module.sessions["second"].turns, ["두 번째"])

    def test_audio_bytes_are_forwarded_to_stt_server(self):
        captured = {}

        def fake_post(url, *, files, timeout):
            filename, content, media_type = files["audio"]
            captured.update(url=url, filename=filename, content=content.read(), media_type=media_type)
            return self.stt_response("아메리카노")

        self.post.side_effect = fake_post
        response = self.send_audio(filename="first.webm", content=b"test-first-audio")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(captured["url"], "http://stt.internal:8001/transcribe")
        self.assertEqual(captured["filename"], "first.webm")
        self.assertEqual(captured["content"], b"test-first-audio")

    def test_empty_transcript_does_not_create_or_mutate_order_session(self):
        self.post.side_effect = [self.stt_response("아메리카노"), self.stt_response("   ")]
        self.assertEqual(self.send_audio().status_code, 200)
        failure = self.send_audio()
        self.assertEqual(failure.status_code, 422)
        self.assertEqual(order_module.sessions["session-1"].turns, ["아메리카노"])

    def test_stt_connection_and_timeout_do_not_start_an_order(self):
        for error, status in ((httpx.ConnectError("unreachable"), 502), (httpx.ReadTimeout("timeout"), 504)):
            with self.subTest(status=status):
                self.post.side_effect = error
                response = self.send_audio()
                self.assertEqual(response.status_code, status)
                self.assertNotIn("session-1", order_module.sessions)

    def test_stt_http_failure_does_not_start_an_order(self):
        self.post.return_value = self.stt_response("", status=500)
        response = self.send_audio()
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("session-1", order_module.sessions)

    def test_invalid_stt_url_does_not_start_an_order(self):
        self.post.side_effect = httpx.InvalidURL("invalid address")
        response = self.send_audio()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("session-1", order_module.sessions)

    def test_bad_stt_response_does_not_start_an_order(self):
        self.post.return_value = httpx.Response(
            200, json={"unexpected": "value"},
            request=httpx.Request("POST", "http://stt.internal:8001/transcribe"),
        )
        response = self.send_audio()
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("session-1", order_module.sessions)

    def test_invalid_json_from_stt_does_not_start_an_order(self):
        self.post.return_value = httpx.Response(
            200, content=b"invalid json",
            request=httpx.Request("POST", "http://stt.internal:8001/transcribe"),
        )
        self.assertEqual(self.send_audio().status_code, 502)
        self.assertNotIn("session-1", order_module.sessions)

    def test_retry_after_stt_failure_only_applies_successful_turn(self):
        self.post.side_effect = [httpx.ReadTimeout("timeout"), self.stt_response("카페 라떼")]
        self.assertEqual(self.send_audio().status_code, 504)
        response = self.send_audio()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(order_module.sessions["session-1"].turns, ["카페 라떼"])

    def test_order_analysis_error_is_exposed_to_caller(self):
        with patch.object(FakeOrderAI, "handle_input", return_value={"error": "api_error", "message": "다시 시도해 주세요."}):
            self.post.return_value = self.stt_response("카페 라떼")
            response = self.send_audio()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "error")
        self.assertEqual(response.json()["result"]["error"], "api_error")

    def test_invalid_file_and_session_are_rejected_before_stt_request(self):
        cases = [
            ({"filename": "bad.txt"}, 415),
            ({"content": b""}, 422),
            ({"session_id": "   "}, 400),
            ({"session_id": "x" * 101}, 400),
        ]
        for args, status in cases:
            with self.subTest(args=args):
                self.assertEqual(self.send_audio(**args).status_code, status)
        self.post.assert_not_called()
        self.assertFalse(order_module.sessions)

    def test_oversize_file_is_rejected_before_stt_request(self):
        with patch.object(order_module, "MAX_AUDIO_BYTES", 3):
            response = self.send_audio(content=b"four")
        self.assertEqual(response.status_code, 413)
        self.post.assert_not_called()
        self.assertFalse(order_module.sessions)

    def test_existing_text_endpoint_and_audio_share_same_session(self):
        text = self.client.post("/ai/order/text", json={"session_id": "mixed", "text": "따뜻한 음료"})
        self.post.return_value = self.stt_response("카페 라떼")
        audio = self.send_audio("mixed")
        self.assertEqual(text.status_code, 200)
        self.assertEqual(audio.status_code, 200)
        self.assertEqual(order_module.sessions["mixed"].turns, ["따뜻한 음료", "카페 라떼"])

    def test_real_order_analysis_keeps_history_for_answer_to_clarification(self):
        fake_openai = Mock()
        first = order_module.Interpretation(
            operations=[], recommendations=[], edit_requested=False, clarification="어떤 메뉴로 드릴까요?",
        )
        second = order_module.Interpretation(
            operations=[order_module.Operation(action="add", menu="카페 라떼", quantity=1)],
            recommendations=[], edit_requested=False, clarification=None,
        )
        fake_openai.responses.parse.side_effect = [
            types.SimpleNamespace(output_parsed=first), types.SimpleNamespace(output_parsed=second),
        ]
        self.post.side_effect = [self.stt_response("커피 주세요"), self.stt_response("카페 라떼요")]
        with patch.object(order_module, "OrderAI", side_effect=lambda: RealOrderAI(client=fake_openai)):
            one = self.send_audio()
            two = self.send_audio()

        self.assertEqual(one.status_code, 200)
        self.assertEqual(one.json()["result"]["message"], "어떤 메뉴로 드릴까요?")
        self.assertEqual(two.status_code, 200)
        self.assertEqual(two.json()["result"]["cart"][0]["menu"], "카페 라떼")
        second_input = json.loads(fake_openai.responses.parse.call_args_list[1].kwargs["input"])
        self.assertEqual(second_input["utterance"], "카페 라떼요")
        self.assertEqual(second_input["recent_dialogue"][0]["user"], "커피 주세요")
        self.assertEqual(second_input["recent_dialogue"][1]["result"]["message"], "어떤 메뉴로 드릴까요?")


if __name__ == "__main__":
    unittest.main()
