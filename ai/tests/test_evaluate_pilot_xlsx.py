import csv
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from zipfile import ZipFile

import evaluate_pilot_xlsx as pilot
from stt_service import STTConfig, Transcription


class PilotEvaluationTests(unittest.TestCase):
    def test_matches_normalized_korean_filename_and_scores_result(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive_path = root / "audio.zip"
            with ZipFile(archive_path, "w") as archive:
                archive.writestr("스피키음성데이터/임현서 STT-001.m4a", b"audio")
            records = [pilot.PilotRow({
                "파일명": "임현서-001.m4a",
                "원본 파일명": "임현서 STT-001.m4a",
                "정답 문장": "아메리카노 한 잔 주세요",
                "녹음자": "임현서",
            }, 2)]
            engine = Mock()
            engine.load.return_value = 1.0
            engine.transcribe.return_value = Transcription("아메리카노 한 잔 주세요", 2.0, 0.5)
            output = root / "result.csv"
            with patch.object(pilot, "read_pilot_rows", return_value=records), patch.object(
                pilot, "STTEngine", return_value=engine
            ):
                summary = pilot.run(root / "evaluation.xlsx", archive_path, output, STTConfig("medium", "cpu", "int8"))

            self.assertEqual(summary["evaluation_rows"], 1)
            self.assertEqual(summary["succeeded"], 1)
            self.assertEqual(summary["missing_audio"], 0)
            self.assertEqual(summary["exact_match_rate"], 1.0)
            self.assertEqual(summary["normalized_cer"], 0.0)
            with output.open(encoding="utf-8-sig") as source:
                row = next(csv.DictReader(source))
            self.assertEqual(row["STT 추출 결과"], "아메리카노 한 잔 주세요")
            self.assertEqual(row["정확히 일치"], "O")
            self.assertIn("임현서", row["ZIP 내부 경로"])
            with self.assertRaises(FileExistsError):
                pilot.run(root / "evaluation.xlsx", archive_path, output, STTConfig())

    def test_missing_audio_is_reported_without_loading_model(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive_path = root / "audio.zip"
            with ZipFile(archive_path, "w") as archive:
                archive.writestr("other.m4a", b"audio")
            records = [pilot.PilotRow({
                "파일명": "배윤성-033.m4a", "원본 파일명": "배윤성33.m4a",
                "정답 문장": "바닐라 크림 라떼 주세요",
            }, 2)]
            with patch.object(pilot, "read_pilot_rows", return_value=records), patch.object(pilot, "STTEngine") as factory:
                summary = pilot.run(root / "evaluation.xlsx", archive_path, root / "result.csv", STTConfig())
            self.assertEqual(summary["missing_audio"], 1)
            self.assertEqual(summary["succeeded"], 0)
            self.assertEqual(summary["extra_audio_in_zip"], ["other.m4a"])
            factory.return_value.load.assert_not_called()

    def test_duplicate_zip_basename_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "audio.zip"
            with ZipFile(path, "w") as archive:
                archive.writestr("first/배윤성33.m4a", b"one")
                archive.writestr("second/배윤성33.m4a", b"two")
            with ZipFile(path) as archive, self.assertRaisesRegex(ValueError, "Duplicate audio"):
                pilot.index_zip_audio(archive)


if __name__ == "__main__":
    unittest.main()
