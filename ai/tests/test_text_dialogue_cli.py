import contextlib
import copy
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import evaluate_dialogue
import text_dialogue
from dialogue_design import validate_assets as assets
from dialogue_design.ollama_client import ModelError


class TextDialogueCLITests(unittest.TestCase):
    def test_registered_scenario_logs_two_extractions_and_confirmation(self):
        client = Mock()
        answers = [
            {"intent": "discover_menu", "set": {"category": "coffee", "temperature": "ICE", "quantity": 1}, "clear": [], "clarification": None, "evidence": {"category": "커피", "temperature": "시원한", "quantity": "한 잔"}, "recommendations": []},
            {"intent": "select_menu", "set": {"menu_id": 1}, "clear": [], "clarification": None, "evidence": {"menu_id": "아메리카노"}, "recommendations": []},
            {"intent": "confirm_selection", "set": {}, "clear": [], "clarification": None, "evidence": {"intent": "담아 줘"}, "recommendations": []},
        ]
        client.extract.side_effect = [(answer, {"wall_seconds": 0.1}) for answer in answers]
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "session.jsonl"
            with patch.object(text_dialogue, "OllamaClient", return_value=client), patch("sys.argv", ["text_dialogue.py", "--scenario", "registered", "--log-file", str(log)]), contextlib.redirect_stdout(io.StringIO()) as output:
                code = text_dialogue.main()
            records = [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines()]
        self.assertEqual(code, 0)
        self.assertEqual(len(records), 3)
        self.assertTrue(json.loads(output.getvalue()[output.getvalue().rfind('\n{') + 1:])["completed_cart_preview"])
        self.assertEqual(records[-1]["result"]["cart_preview"][0]["menu_id"], 1)
        second_context = client.extract.call_args_list[1].args[1]
        self.assertEqual(second_context["state"]["temperature"], "ICE")
        self.assertEqual(second_context["candidate_ids"], [1, 2, 3])

    def test_evaluation_counts_model_failures_and_does_not_send_gold(self):
        client = Mock()
        client.check.return_value = {"installed": True}
        second = copy.deepcopy(assets.load_examples()[1]["expected"])
        second["recommendations"] = []
        client.extract.side_effect = [ModelError("offline"), (second, {"wall_seconds": 0.2})]
        with tempfile.TemporaryDirectory() as directory:
            result_dir = Path(directory) / "results"
            with patch.object(evaluate_dialogue, "OllamaClient", return_value=client), patch("sys.argv", ["evaluate_dialogue.py", "--limit", "2", "--output-dir", str(result_dir)]), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                code = evaluate_dialogue.main()
            summary = json.loads((result_dir / "summary.json").read_text(encoding="utf-8"))
            records = [json.loads(line) for line in (result_dir / "predictions.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual(code, 1)
        self.assertEqual(summary["counts"]["processed"], 2)
        self.assertEqual(summary["counts"]["failed"], 1)
        self.assertEqual(summary["exact_extraction_rate"], 0.5)
        self.assertIn("error", records[0])
        for call in client.extract.call_args_list:
            self.assertEqual(len(call.args), 3)
            self.assertNotIn("expected", call.args[1])


if __name__ == "__main__":
    unittest.main()
