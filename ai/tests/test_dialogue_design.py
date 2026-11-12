import json
import unittest

from dialogue_design import validate_assets as assets


class DialogueDesignTests(unittest.TestCase):
    def test_unknown_attributes_do_not_become_matches_or_nonmatches(self):
        result = assets.filter_catalog(assets.load_catalog(), {"category": "coffee", "milk": "without"})
        self.assertEqual(result["eligible_ids"], [])
        self.assertEqual(result["undetermined_ids"], [1, 2, 3])
        self.assertEqual(result["excluded_ids"], [4, 5, 6, 7, 8, 9])

    def test_mixed_verified_and_unknown_candidates_remain_separate(self):
        result = assets.filter_catalog(assets.load_catalog(demo=True), {"temperature": "ICE", "caffeine": "without"})
        self.assertEqual(result["eligible_ids"], [5])
        self.assertEqual(result["undetermined_ids"], [6])
        self.assertEqual(result["excluded_ids"], [1, 2, 3, 4, 7, 8, 9])

    def test_soft_sweetness_preference_does_not_exclude_products(self):
        result = assets.filter_catalog(assets.load_catalog(demo=True), {"category": "coffee", "sweetness_preference": "less_sweet"})
        self.assertEqual(result["eligible_ids"], [1, 2, 3])

    def test_update_changes_only_requested_fields(self):
        before = {"menu_id": 1, "temperature": "ICE", "quantity": 2, "size": "LARGE"}
        after = assets.apply_patch(before, {"set": {"temperature": "HOT"}, "clear": ["size"]})
        self.assertEqual(after["temperature"], "HOT")
        self.assertEqual(after["quantity"], 2)
        self.assertEqual(after["menu_id"], 1)
        self.assertIsNone(after["size"])
        self.assertEqual(before["temperature"], "ICE")
        self.assertEqual(before["size"], "LARGE")

    def test_demo_loading_does_not_modify_the_source_catalog(self):
        demo = assets.load_catalog(demo=True)
        source = assets.load_catalog()
        self.assertFalse(demo["menus"][0]["attributes"]["milk"])
        self.assertIsNone(source["menus"][0]["attributes"]["milk"])
        self.assertEqual(demo["data_status"], "demo_only")
        self.assertEqual(source["data_status"], "needs_store_enrichment")
        self.assertEqual([menu["price"] for menu in demo["menus"]], [menu["price"] for menu in source["menus"]])

    def test_model_input_contains_context_but_no_gold_answers(self):
        case = next(item for item in assets.load_examples() if item["id"] == "C04")
        messages = assets.build_messages(case)
        payload = json.loads(messages[1]["content"])
        self.assertEqual(payload["dialogue_context"]["candidate_ids"], [1, 3])
        self.assertEqual(payload["utterance"], "두 번째 거 한 잔 주세요.")
        self.assertEqual(len(payload["menus"]), 9)
        self.assertTrue(all(not key.startswith("expected") for key in payload))
        self.assertIn("output_schema", json.loads(messages[0]["content"]))

    def test_temperature_mismatch_is_not_hidden_by_unknown_size(self):
        result = assets.filter_catalog(assets.load_catalog(), {"menu_id": 6, "temperature": "HOT", "size": "LARGE"})
        self.assertEqual(result["eligible_ids"], [])
        self.assertEqual(result["undetermined_ids"], [])
        self.assertIn(6, result["excluded_ids"])


if __name__ == "__main__":
    unittest.main()
