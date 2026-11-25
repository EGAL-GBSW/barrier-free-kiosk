import contextlib
import copy
import csv
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import compare_dialogue_models as compare
from dialogue_design import validate_assets as assets
from dialogue_design.conversation import load_runtime_catalog
from dialogue_design.ollama_client import ModelError, OllamaClient


class ComparisonTests(unittest.TestCase):
    def setUp(self):
        self.examples = assets.load_examples()
        self.clients = {}
        self.constructor_options = {}

    def client_factory(self, *args, **kwargs):
        model = args[0] if args else kwargs["model"]
        test = self

        class Client:
            def __init__(self):
                self.model = model
                self.calls = []
                self.requests = []

            def check(self):
                return {"installed": True}

            def _request(self, endpoint, body):
                self.requests.append((endpoint, body))
                return {}

            def extract(self, catalog, context, utterance):
                self.calls.append((copy.deepcopy(catalog), copy.deepcopy(context), utterance))
                if model == compare.DEFAULT_MODELS[1] and len(self.calls) == 3:
                    raise ModelError("simulated request failure")
                source = "demo" if catalog["data_status"] == "demo_only" else "source"
                case = next(c for c in test.examples if c["catalog"] == source and c["utterance"] == utterance and c["context"] == context)
                result = copy.deepcopy(case["expected"])
                result["recommendations"] = []
                return result, {"wall_seconds": 999.0 if len(self.calls) == 1 else 0.2, "attempts": 1}

        client = Client()
        self.clients[model] = client
        self.constructor_options[model] = kwargs
        return client

    def run_comparison(self, output, *arguments):
        with patch.object(compare, "OllamaClient", side_effect=self.client_factory), patch("sys.argv", ["compare_dialogue_models.py", "--output-dir", str(output), *arguments]), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            return compare.main()

    def test_default_models_get_identical_inputs_and_errors_count_against_accuracy(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "results"
            code = self.run_comparison(output, "--limit", "2", "--repeats", "2")
            summary = json.loads((output / "summary.json").read_text(encoding="utf-8"))
            details_bytes = (output / "details.csv").read_bytes()
            summary_bytes = (output / "summary.csv").read_bytes()
            details = list(csv.DictReader(io.StringIO(details_bytes.decode("utf-8-sig"))))
            rows = list(csv.DictReader(io.StringIO(summary_bytes.decode("utf-8-sig"))))

        self.assertEqual(code, 1)
        self.assertFalse(summary["interrupted"])
        self.assertEqual([model["model"] for model in summary["models"]], list(compare.DEFAULT_MODELS))
        self.assertEqual(len(details), 12)
        self.assertEqual(len(rows), 3)
        self.assertTrue(details_bytes.startswith(b"\xef\xbb\xbf"))
        self.assertTrue(summary_bytes.startswith(b"\xef\xbb\xbf"))
        expected_calls = self.clients[compare.DEFAULT_MODELS[0]].calls
        self.assertEqual(len(expected_calls), 5)  # one warmup, two examples, two repetitions
        for model in compare.DEFAULT_MODELS:
            self.assertEqual(self.clients[model].calls, expected_calls)
            self.assertEqual(self.clients[model].requests, [("/api/generate", {"model": model, "keep_alive": 0})])
            for catalog, context, _utterance in self.clients[model].calls:
                self.assertNotIn("expected", catalog)
                self.assertNotIn("expected", context)
        for index, result in enumerate(summary["models"]):
            successful = 3 if index == 1 else 4
            self.assertEqual(result["counts"]["total"], 4)
            self.assertEqual(result["counts"]["valid"], successful)
            self.assertEqual(result["counts"]["failed"], 4 - successful)
            self.assertEqual(result["counts"]["exact"], successful)
            self.assertEqual(result["rates"]["exact"], successful / 4)
            self.assertEqual(result["latency"]["success_count"], successful)
        self.assertIsNone(self.constructor_options[compare.DEFAULT_MODELS[0]].get("think"))
        for model in compare.DEFAULT_MODELS[1:]:
            self.assertIs(self.constructor_options[model].get("think"), False)

    def test_source_filter_uses_same_real_catalog_cases_for_every_model(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "source"
            code = self.run_comparison(output, "--models", "custom-a", "custom-b", "--catalog", "source", "--limit", "3")
            summary = json.loads((output / "summary.json").read_text(encoding="utf-8"))

        self.assertEqual(code, 0)
        self.assertEqual([row["model"] for row in summary["models"]], ["custom-a", "custom-b"])
        self.assertEqual(self.clients["custom-a"].calls, self.clients["custom-b"].calls)
        for catalog, _context, _utterance in self.clients["custom-a"].calls:
            self.assertNotEqual(catalog["data_status"], "demo_only")
        self.assertEqual(summary["models"][0]["counts"]["total"], 3)

    def test_false_think_reaches_ollama_and_none_keeps_its_default(self):
        case = self.examples[0]
        catalog = load_runtime_catalog(demo=case["catalog"] == "demo")
        prediction = copy.deepcopy(case["expected"])
        prediction["recommendations"] = []
        response = {"done": True, "message": {"content": json.dumps(prediction, ensure_ascii=False)}}
        for think in (False, None):
            with self.subTest(think=think):
                client = OllamaClient(model="test", think=think)
                with patch.object(client, "_request", return_value=response) as request:
                    client.extract(catalog, case["context"], case["utterance"])
                endpoint, body = request.call_args.args
                self.assertEqual(endpoint, "/api/chat")
                if think is None:
                    self.assertNotIn("think", body)
                else:
                    self.assertIs(body["think"], False)

    def test_field_metrics_record_missing_wrong_and_extra_conditions(self):
        case = self.examples[0]
        prediction = copy.deepcopy(case["expected"])
        prediction["set"]["quantity"] = 2
        prediction["set"]["category"] = "coffee"
        client = Mock(model="test")
        client.model = "test"
        client.extract.return_value = (prediction, {"attempts": 1})
        record, elapsed, error_time = compare.evaluate_case(client, case, {}, 1)
        self.assertEqual(record["expected_set_field_count"], 3)
        self.assertEqual(record["predicted_set_field_count"], 4)
        self.assertEqual(record["correct_set_field_count"], 2)
        self.assertFalse(record["set_match"])
        self.assertIsNotNone(elapsed)
        self.assertIsNone(error_time)


if __name__ == "__main__":
    unittest.main()
