import csv
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import compare_pilot_models as compare


class PilotComparisonTests(unittest.TestCase):
    def test_run_model_uses_a_separate_python_process(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "medium.csv"
            commands = []

            def fake_subprocess(command, check):
                commands.append(command)
                output.write_text("file,transcript\n", encoding="utf-8")
                output.with_suffix(".summary.json").write_text(
                    json.dumps({"model": "medium", "failed": 0}), encoding="utf-8"
                )
                return SimpleNamespace(returncode=0)

            with patch.object(compare.subprocess, "run", side_effect=fake_subprocess):
                summary = compare.run_model(
                    "medium", root / "source.xlsx", root / "audio.zip", output,
                    "cpu", "int8", 3, False,
                )
            self.assertEqual(summary["model"], "medium")
            self.assertEqual(commands[0][0], compare.sys.executable)
            self.assertIn("evaluate_pilot_xlsx.py", commands[0][1])
            self.assertEqual(commands[0][commands[0].index("--model") + 1], "medium")

    def test_runs_models_sequentially_and_merges_side_by_side(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            calls = []

            def fake_run_model(model, evaluation_xlsx, audio_zip, output_csv, device, compute_type, limit, overwrite):
                calls.append(model)
                with output_csv.open("w", newline="", encoding="utf-8-sig") as destination:
                    writer = csv.DictWriter(destination, fieldnames=(
                        "파일명", "STT ID", "정답 문장", "메뉴", "발화 유형", "원본 파일명",
                        "STT 추출 결과", "정확히 일치", "정규화 CER", "처리 시간(초)", "상태", "오류 메모",
                    ))
                    writer.writeheader()
                    writer.writerow({
                        "파일명": "배윤성-033.m4a", "STT ID": "STT-033", "정답 문장": "라떼 주세요",
                        "메뉴": "라떼", "발화 유형": "기본", "원본 파일명": "배윤성33.m4a",
                        "STT 추출 결과": "라떼 주세요" if model == "large-v3" else "라떼",
                        "정확히 일치": "O" if model == "large-v3" else "X",
                        "정규화 CER": "0" if model == "large-v3" else "0.4",
                        "처리 시간(초)": "1.2", "상태": "ok", "오류 메모": "",
                    })
                summary = {
                    "model": model, "evaluation_rows": 1, "processed": 1, "succeeded": 1,
                    "failed": 0, "missing_audio": 0,
                    "exact_match_rate": 1.0 if model == "large-v3" else 0.0,
                    "normalized_cer": 0.0 if model == "large-v3" else 0.4,
                }
                output_csv.with_suffix(".summary.json").write_text(json.dumps(summary), encoding="utf-8")
                return summary

            with patch.object(compare, "run_model", side_effect=fake_run_model):
                (root / "source.xlsx").touch()
                (root / "audio.zip").touch()
                summary = compare.run_comparison(root / "source.xlsx", root / "audio.zip", root, "cpu", "int8")

            self.assertEqual(calls, ["medium", "large-v3"])
            self.assertEqual(summary["per_file_lower_cer"]["large-v3"], 1)
            self.assertEqual(summary["exact_match_gain_large_v3_percentage_points"], 100.0)
            self.assertEqual(summary["cer_reduction_large_v3"], 0.4)
            with (root / "pilot_medium_vs_large-v3.csv").open(encoding="utf-8-sig") as source:
                row = next(csv.DictReader(source))
            self.assertEqual(row["medium STT 추출 결과"], "라떼")
            self.assertEqual(row["large-v3 STT 추출 결과"], "라떼 주세요")

    def test_rejects_mismatched_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = [root / "medium.csv", root / "large.csv"]
            for path, name in zip(paths, ("a.m4a", "b.m4a")):
                with path.open("w", newline="", encoding="utf-8") as destination:
                    writer = csv.DictWriter(destination, fieldnames=compare.SHARED_COLUMNS + compare.MODEL_COLUMNS)
                    writer.writeheader()
                    writer.writerow({"파일명": name, "원본 파일명": name, "상태": "ok", "정규화 CER": "0"})
            with self.assertRaisesRegex(ValueError, "do not align"):
                compare.merge_results(paths[0], paths[1], root / "combined.csv")


if __name__ == "__main__":
    unittest.main()
