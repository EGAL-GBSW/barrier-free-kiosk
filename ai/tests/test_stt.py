import io
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient

import api
import benchmark_stt
from stt_service import STTConfig, STTEngine, Transcription


class STTEngineTests(unittest.TestCase):
    def test_loads_once_and_consumes_segments(self):
        model = Mock()
        model.transcribe.side_effect = [
            (iter([SimpleNamespace(text=" 아메리카노"), SimpleNamespace(text=" 한 잔")]), SimpleNamespace(duration=3.5)),
            (iter([SimpleNamespace(text=" 콜라")]), SimpleNamespace(duration=1.0)),
        ]
        factory = Mock(return_value=model)
        engine = STTEngine(STTConfig("medium", "cpu", "int8"), model_factory=factory)

        first = engine.transcribe(io.BytesIO(b"sample"))
        second = engine.transcribe(io.BytesIO(b"other"))

        self.assertEqual(first.text, "아메리카노 한 잔")
        self.assertEqual(first.audio_duration_seconds, 3.5)
        self.assertEqual(second.text, "콜라")
        self.assertEqual(factory.call_count, 1)
        self.assertEqual(model.transcribe.call_args.kwargs["language"], "ko")
        self.assertEqual(model.transcribe.call_args.kwargs["beam_size"], 5)
        self.assertEqual(model.transcribe.call_args.kwargs["temperature"], 0)


class APITests(unittest.TestCase):
    def setUp(self):
        self.engine = Mock()
        self.engine.config = STTConfig("medium", "cpu", "int8")
        self.engine.loaded = True
        self.engine.transcribe.return_value = Transcription("콜라 한 잔", 2.0, 0.25)
        self.engine_patch = patch.object(api, "engine", self.engine)
        self.engine_patch.start()
        self.addCleanup(self.engine_patch.stop)
        self.client = TestClient(api.app)

    def test_upload_returns_transcript(self):
        response = self.client.post("/transcribe", files={"audio": ("test.m4a", b"fake-audio", "audio/mp4")})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["transcript"], "콜라 한 잔")
        self.assertEqual(response.json()["model"], "medium")
        self.assertEqual(self.engine.transcribe.call_count, 1)

    def test_rejects_unsupported_and_empty_uploads(self):
        unsupported = self.client.post("/transcribe", files={"audio": ("test.txt", b"text", "text/plain")})
        empty = self.client.post("/transcribe", files={"audio": ("test.wav", b"", "audio/wav")})
        self.assertEqual(unsupported.status_code, 415)
        self.assertEqual(empty.status_code, 422)
        self.engine.transcribe.assert_not_called()

    def test_rejects_oversize_upload(self):
        with patch.object(api, "MAX_AUDIO_BYTES", 3):
            response = self.client.post("/transcribe", files={"audio": ("test.wav", b"four", "audio/wav")})
        self.assertEqual(response.status_code, 413)
        self.engine.transcribe.assert_not_called()


class BenchmarkTests(unittest.TestCase):
    def test_korean_normalization_and_edit_distance(self):
        self.assertEqual(benchmark_stt.normalize("아메리카노, 한 잔!"), "아메리카노한잔")
        self.assertEqual(benchmark_stt.edit_distance("콜라한잔", "콜라두잔"), 1)

    def test_reports_group_cer_and_latency(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "test.m4a").write_bytes(b"fake-audio")
            (root / "manifest.csv").write_text(
                "file,reference,group\ntest.m4a,콜라 한 잔,사투리\n", encoding="utf-8"
            )
            fake_engine = Mock()
            fake_engine.load.return_value = 1.2
            fake_engine.transcribe.return_value = Transcription("콜라 두 잔", 2.0, 0.5)
            with patch.object(benchmark_stt, "STTEngine", return_value=fake_engine):
                report = benchmark_stt.run(root / "manifest.csv", STTConfig("medium", "cpu", "int8"))

        self.assertEqual(report["samples"], 1)
        self.assertEqual(report["model_load_seconds"], 1.2)
        self.assertEqual(report["normalized_cer"], 0.25)
        self.assertEqual(report["groups"]["사투리"]["samples"], 1)
        self.assertEqual(report["groups"]["사투리"]["normalized_cer"], 0.25)


if __name__ == "__main__":
    unittest.main()
