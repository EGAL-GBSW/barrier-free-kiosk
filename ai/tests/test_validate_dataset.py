import csv
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import validate_dataset
from stt_service import STTConfig, Transcription


class DatasetValidationTests(unittest.TestCase):
    def test_scores_labeled_audio_and_records_failed_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            audio_dir = root / "audio"
            audio_dir.mkdir()
            (audio_dir / "a.m4a").write_bytes(b"good")
            (audio_dir / "b.wav").write_bytes(b"broken")
            (audio_dir / "notes.txt").write_text("ignored", encoding="utf-8")
            references = root / "references.csv"
            references.write_text(
                "file,reference,group\na.m4a,콜라 한 잔,표준어\nb.wav,아메리카노,사투리\n",
                encoding="utf-8",
            )
            engine = Mock()
            engine.load.return_value = 1.25
            engine.transcribe.side_effect = [
                Transcription("콜라 두 잔", 2.0, 0.5),
                ValueError("invalid audio"),
            ]
            with patch.object(validate_dataset, "STTEngine", return_value=engine):
                summary = validate_dataset.run(
                    audio_dir, root / "results", STTConfig("medium", "cpu", "int8"), references
                )

            self.assertEqual(summary["audio_files_found"], 2)
            self.assertEqual(summary["succeeded"], 1)
            self.assertEqual(summary["failed"], 1)
            self.assertEqual(summary["labeled"], 1)
            self.assertEqual(summary["normalized_cer"], 0.25)
            self.assertEqual(summary["overall_real_time_factor"], 0.25)
            with (root / "results" / "dataset_validation.csv").open(encoding="utf-8-sig") as source:
                rows = list(csv.DictReader(source))
            self.assertEqual(rows[0]["transcript"], "콜라 두 잔")
            self.assertEqual(rows[0]["character_errors"], "1")
            self.assertEqual(rows[1]["status"], "error")
            self.assertIn("invalid audio", rows[1]["error"])

    def test_unlabeled_limit_and_missing_reference_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            audio_dir = root / "audio"
            audio_dir.mkdir()
            (audio_dir / "a.mp3").write_bytes(b"first")
            (audio_dir / "b.mp3").write_bytes(b"second")
            engine = Mock()
            engine.load.return_value = 0.1
            engine.transcribe.return_value = Transcription("안녕하세요", 1.0, 0.2)
            with patch.object(validate_dataset, "STTEngine", return_value=engine):
                summary = validate_dataset.run(
                    audio_dir, root / "results", STTConfig("medium", "cpu", "int8"), limit=1
                )
            self.assertEqual(summary["processed"], 1)
            self.assertEqual(summary["labeled"], 0)
            self.assertIsNone(summary["normalized_cer"])
            self.assertEqual(engine.transcribe.call_count, 1)

            references = root / "references.csv"
            references.write_text("file,reference\nmissing.mp3,안녕하세요\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "not found"):
                validate_dataset.run(audio_dir, root / "results", STTConfig(), references)


if __name__ == "__main__":
    unittest.main()
