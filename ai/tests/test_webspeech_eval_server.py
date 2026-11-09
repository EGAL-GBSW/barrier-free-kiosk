"""Offline tests for local pilot dataset serving and analysis routing."""

import tempfile
import unittest
import unicodedata
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

import httpx
from fastapi.testclient import TestClient
from openpyxl import Workbook

from webspeech_eval.server import character_error_rate, create_app


class WebSpeechEvalServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.xlsx = root / "cases.xlsx"
        self.zip_path = root / "audio.zip"
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Pilot_Test"
        sheet.append(["파일명", "원본 파일명", "정답 문장", "메뉴", "발화 유형"])
        sheet.append(["평가1.m4a", "가나다1.m4a", "아메리카노 한 잔", "아메리카노", "기본"])
        sheet.append(["평가2.m4a", "duplicate.m4a", "카페 라떼", "카페 라떼", "자연발화"])
        sheet.append(["평가3.m4a", "missing.m4a", "정답", "메뉴", "기본"])
        sheet.append(["평가4.m4a", "empty.m4a", None, "메뉴", "기본"])
        sheet.append(["평가5.m4a", "over.m4a", "정답", "메뉴", "기본"])
        workbook.save(self.xlsx)
        workbook.close()
        with ZipFile(self.zip_path, "w") as archive:
            archive.writestr("nested/" + unicodedata.normalize("NFD", "가나다1.m4a"), b"pilot")
            archive.writestr("a/duplicate.m4a", b"one")
            archive.writestr("b/duplicate.m4a", b"two")
            archive.writestr("empty.m4a", b"data")
            archive.writestr("over.m4a", b"123456")

    def client(self, analyzer=lambda transcript: {"status": "review"}, **kwargs):
        app = create_app(self.xlsx, self.zip_path, analyzer=analyzer, **kwargs)
        client = TestClient(app)
        self.addCleanup(client.close)
        return client

    def test_nfc_filename_match_streams_zip_member_without_extraction(self):
        xlsx_before = self.xlsx.read_bytes()
        zip_before = self.zip_path.read_bytes()
        client = self.client(limit=1)
        cases = client.get("/api/cases").json()["cases"]
        self.assertEqual(len(cases), 1)
        self.assertIsNone(cases[0]["error"])
        self.assertEqual(cases[0]["audio_url"], "/api/audio/1")
        audio = client.get(cases[0]["audio_url"])
        self.assertEqual(audio.status_code, 200)
        self.assertEqual(audio.content, b"pilot")
        self.assertEqual(audio.headers["content-type"], "audio/mp4")
        self.assertEqual(self.xlsx.read_bytes(), xlsx_before)
        self.assertEqual(self.zip_path.read_bytes(), zip_before)

    def test_missing_duplicate_and_oversize_are_safe_case_errors(self):
        with patch("webspeech_eval.server.MAX_AUDIO_BYTES", 5):
            client = self.client()
            cases = client.get("/api/cases").json()["cases"]
        self.assertIsNone(cases[0]["error"])
        for case in cases[1:]:
            self.assertIsNotNone(case["error"])
            self.assertIsNone(case["audio_url"])
            self.assertEqual(client.get(f"/api/audio/{case['id']}").status_code, 404)

    def test_analyze_returns_reference_cer_and_injected_result(self):
        client = self.client(analyzer=lambda transcript: {"decision": "needs_review", "text": transcript})
        response = client.post("/api/analyze", json={"case_id": 1, "transcript": "아메리카노 한 잔!"})
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["cer"], 0)
        self.assertEqual(result["expected_menu"], "아메리카노")
        self.assertEqual(result["analysis"]["decision"], "needs_review")
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_invalid_input_does_not_call_analyzer(self):
        calls = []
        client = self.client(analyzer=lambda text: calls.append(text))
        for payload, status in [
            ({"case_id": 999, "transcript": "문장"}, 404),
            ({"case_id": 1, "transcript": "  "}, 422),
            ({"case_id": 1, "transcript": "x" * 2001}, 422),
            ({"case_id": True, "transcript": "문장"}, 422),
            ({"case_id": 2, "transcript": "문장"}, 422),
        ]:
            with self.subTest(payload=payload):
                self.assertEqual(client.post("/api/analyze", json=payload).status_code, status)
        self.assertFalse(calls)

    def test_analyzer_errors_do_not_expose_exception_details(self):
        for exc, status in [(ValueError("private"), 422), (RuntimeError("private"), 503), (Exception("private"), 502)]:
            def failing(_text, error=exc):
                raise error
            with self.subTest(status=status):
                response = self.client(analyzer=failing).post(
                    "/api/analyze", json={"case_id": 1, "transcript": "문장"})
                self.assertEqual(response.status_code, status)
                self.assertNotIn("private", response.text)

    def test_local_assets_and_independent_sample_inputs(self):
        texts = []
        client = self.client(analyzer=lambda text: texts.append(text) or {"decision": "undetermined"})
        for path in ("/", "/app.js", "/styles.css"):
            self.assertEqual(client.get(path).status_code, 200)
        for text in ("첫 번째 발화", "두 번째 발화"):
            self.assertEqual(client.post("/api/analyze", json={"case_id": 1, "transcript": text}).status_code, 200)
        self.assertEqual(texts, ["첫 번째 발화", "두 번째 발화"])

    def test_character_error_rate_handles_punctuation_and_empty_reference(self):
        self.assertEqual(character_error_rate("아메리카노, 한 잔!", "아메리카노 한잔"), 0)
        self.assertIsNone(character_error_rate(" . ", "문장"))
        self.assertGreater(character_error_rate("두 잔", "한 잔"), 0)

    def test_remote_analyzer_receives_only_transcript_and_returns_analysis(self):
        url = "https://order.internal/ai/evaluate/text"
        response = httpx.Response(200, json={"analysis": {"decision": "review"}},
                                  request=httpx.Request("POST", url))
        with patch("webspeech_eval.server.httpx.post", return_value=response) as post:
            client = self.client(analysis_url=url, analyzer=lambda _: self.fail("local analyzer called"))
            result = client.post("/api/analyze", json={"case_id": 1, "transcript": "  카페 라떼  "})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["analysis"], {"decision": "review"})
        post.assert_called_once_with(url, json={"transcript": "카페 라떼"}, timeout=120.0)

    def test_remote_failures_do_not_expose_exception_details(self):
        url = "https://order.internal/ai/evaluate/text"
        request = httpx.Request("POST", url)
        cases = [
            (httpx.ReadTimeout("private"), 504),
            (httpx.ConnectError("private"), 502),
            (httpx.Response(500, text="private", request=request), 502),
            (httpx.Response(200, text="not json", request=request), 502),
            (httpx.Response(200, json={"analysis": None}, request=request), 502),
        ]
        for value, expected_status in cases:
            with self.subTest(status=expected_status):
                with patch("webspeech_eval.server.httpx.post") as post:
                    if isinstance(value, Exception):
                        post.side_effect = value
                    else:
                        post.return_value = value
                    response = self.client(analysis_url=url).post(
                        "/api/analyze", json={"case_id": 1, "transcript": "문장"})
                    self.assertEqual(response.status_code, expected_status)
                    self.assertNotIn("private", response.text)


if __name__ == "__main__":
    unittest.main()
