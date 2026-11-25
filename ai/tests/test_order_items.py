"""백엔드 주문 항목과 재질문을 실제 OpenAI 호출 없이 검증한다."""
import json
import os
from pathlib import Path
import subprocess
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import httpx
from fastapi.testclient import TestClient
from voice_order import order_ai


def interpretation(*operations, clarification=None, recommendations=None, checkout="none"):
    return order_ai.Interpretation(operations=list(operations), recommendations=recommendations or [],
                                   edit_requested=False, clarification=clarification, checkout=checkout)


def op(action, menu=None, quantity=None, **kwargs):
    return order_ai.Operation(action=action, menu=menu, quantity=quantity, **kwargs)


class OrderItemsTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {"MENU_API_URL": ""})
        env.start()
        self.addCleanup(env.stop)
        self.client = Mock()
        self.order = order_ai.OrderAI(client=self.client, model="test-model")

    def send(self, result, text="사용자 발화"):
        self.client.responses.parse.return_value = SimpleNamespace(output_parsed=result)
        return self.order.handle_input(text)

    def test_missing_options_are_asked_and_exact_items_returned(self):
        result = self.send(interpretation(op("add", "아메리카노", 2)))
        self.assertEqual(result["pending"]["field"], "temperature")
        self.assertEqual(result["items"], [])
        for fields, expected in (({"temperature": "ICE"}, "size"), ({"size": "Regular"}, "shots")):
            result = self.send(interpretation(op("update_options", **fields)))
            self.assertEqual(result["pending"]["field"], expected)
        result = self.send(interpretation(op("update_options", shots=0)))
        self.assertTrue(result["ready_for_quote"])
        self.assertFalse(result["needs_clarification"])
        self.assertIsNone(result["total_amount"])
        self.assertEqual(result["items"], [{"menuId": 1, "quantity": 2, "temperature": "ICE", "size": "Regular", "shots": 0}])
        payload = json.loads(self.client.responses.parse.call_args.kwargs["input"])
        self.assertEqual(payload["state"]["pending"]["field"], "shots")

    def test_quantity_is_not_silently_assumed(self):
        result = self.send(interpretation(op("add", "아메리카노")))
        self.assertEqual(result["pending"]["field"], "quantity")
        result = self.send(interpretation(op("update_options", quantity=1)))
        self.assertEqual(result["pending"]["field"], "temperature")

    def test_partial_order_is_preserved_when_model_also_asks_question(self):
        result = self.send(interpretation(op("add", "아메리카노", 1), clarification="아이스로 드릴까요?"))
        self.assertTrue(result["needs_clarification"])
        self.assertEqual(result["cart"][0]["menu"], "아메리카노")
        self.assertEqual(result["items"], [])
        result = self.send(interpretation(op("update_options", temperature="ICE")))
        self.assertEqual(result["pending"]["field"], "size")

    def test_noncoffee_and_bakery_fixed_options(self):
        result = self.send(interpretation(op("add", "리얼 딸기 밀크", 1, temperature="ICE", size="Large"),
                                          op("add", "버터 크루아상", 2)))
        self.assertEqual(result["items"], [
            {"menuId": 5, "quantity": 1, "temperature": "ICE", "size": "Large", "shots": 0},
            {"menuId": 8, "quantity": 2, "temperature": None, "size": "Regular", "shots": 0},
        ])

    def test_invalid_options_never_modify_cart(self):
        cases = [op("add", "리얼 딸기 밀크", 1, temperature="HOT", size="Regular"),
                 op("add", "리얼 딸기 밀크", 1, temperature="ICE", size="Regular", shots=1),
                 op("add", "버터 크루아상", 1, size="Large"), op("add", "아메리카노", 0)]
        for operation in cases:
            with self.subTest(operation=operation):
                result = self.send(interpretation(operation))
                self.assertEqual(result["error"], "invalid_order")
                self.assertEqual(self.order.cart, [])
                self.assertEqual(result["items"], [])

    def test_distinct_options_and_ambiguous_cancellation(self):
        result = self.send(interpretation(
            op("add", "아메리카노", 1, temperature="ICE", size="Regular", shots=0),
            op("add", "아메리카노", 2, temperature="HOT", size="Large", shots=1)))
        self.assertEqual(len(result["items"]), 2)
        result = self.send(interpretation(op("remove", "아메리카노")))
        self.assertEqual(result["error"], "invalid_order")
        self.assertEqual(len(self.order.cart), 2)
        result = self.send(interpretation(op("remove", "아메리카노", temperature="ICE")))
        self.assertEqual(result["items"][0]["temperature"], "HOT")

    def test_checkout_requests_quote_without_creating_payment_or_order(self):
        self.send(interpretation(op("add", "아메리카노", 2, temperature="ICE", size="Regular", shots=0)))
        result = self.send(interpretation(checkout="start"), "결제하기")
        self.assertEqual(result["next_action"], "request_quote")
        self.assertTrue(result["ready_for_quote"])
        self.assertEqual(result["items"][0]["quantity"], 2)
        self.assertIsNone(result["total_amount"])

    def test_checkout_with_missing_option_asks_first(self):
        self.send(interpretation(op("add", "아메리카노", 1)))
        result = self.send(interpretation(checkout="start"), "결제해 주세요")
        self.assertEqual(result["next_action"], "ask_clarification")
        self.assertEqual(result["pending"]["field"], "temperature")
        self.assertEqual(result["items"], [])
        self.assertTrue(result["checkout_pending"])
        self.send(interpretation(op("update_options", temperature="ICE")), "아이스요")
        self.send(interpretation(op("update_options", size="Regular")), "보통이요")
        result = self.send(interpretation(op("update_options", shots=0)), "샷은 추가하지 마세요")
        self.assertEqual(result["next_action"], "request_quote")
        self.assertFalse(result["checkout_pending"])

    def test_cancel_checkout_does_not_clear_order_even_if_model_misclassifies(self):
        self.send(interpretation(op("add", "아메리카노", 2, temperature="ICE", size="Regular", shots=0)))
        self.send(interpretation(checkout="start"), "결제하기")
        result = self.send(interpretation(op("clear"), checkout="cancel"), "결제 취소")
        self.assertEqual(result["next_action"], "cancel_checkout")
        self.assertEqual(result["items"][0]["quantity"], 2)
        self.assertEqual(result["screen"], "menu")

    def test_explicit_menu_and_all_order_cancellation(self):
        self.send(interpretation(op("add", "아메리카노", 2, temperature="ICE", size="Regular", shots=0)))
        result = self.send(interpretation(op("remove", "아메리카노", 1)), "아메리카노 하나 취소")
        self.assertEqual(result["items"][0]["quantity"], 1)
        result = self.send(interpretation(op("clear")), "전체 주문 취소")
        self.assertEqual(result["cart"], [])
        self.assertEqual(result["items"], [])

    def test_clarification_and_recommendations_do_not_emit_items(self):
        for response in (interpretation(recommendations=["카페 라떼"]),
                         interpretation(clarification="어떤 메뉴로 드릴까요?")):
            result = self.send(response)
            self.assertTrue(result["needs_clarification"])
            self.assertEqual(result["items"], [])

    def test_clarification_persists_when_queried_after_complete_cart(self):
        self.send(interpretation(op("add", "아메리카노", 1, temperature="ICE", size="Regular", shots=0)))
        self.send(interpretation(clarification="어느 메뉴를 바꾸시겠어요?"))
        status = self.order.snapshot("현재 주문 상태")
        self.assertTrue(status["needs_clarification"])
        self.assertFalse(status["ready_for_quote"])
        self.assertEqual(status["items"], [])

    def test_health_and_error_status(self):
        self.client.responses.parse.return_value = SimpleNamespace(output_parsed=interpretation(op("add", "아메리카노", 0)))
        order_ai.sessions.clear()
        self.addCleanup(order_ai.sessions.clear)
        with patch.object(order_ai, "OrderAI", return_value=self.order), TestClient(order_ai.app) as client:
            self.assertEqual(client.get("/health").json()["status"], "success")
            response = client.post("/ai/order/text", json={"session_id": "case1", "text": "아메리카노"})
        self.assertEqual(response.json()["status"], "error")
        self.assertEqual(response.json()["result"]["error"], "invalid_order")

    def test_latest_backend_menu_ids_and_failure_preserve_order(self):
        menu = {"id": 123, "name": "아메리카노", "category": "coffee", "price": 3300, "temperatures": ["ICE", "HOT"]}
        response = httpx.Response(200, json=[menu], request=httpx.Request("GET", "http://backend/menus"))
        with patch.dict(os.environ, {"MENU_API_URL": "http://backend/menus"}), patch.object(order_ai.httpx, "get", return_value=response):
            result = self.send(interpretation(op("add", "아메리카노", 1, temperature="HOT", size="Regular", shots=0)))
        self.assertEqual(result["items"][0]["menuId"], 123)
        self.assertEqual(result["catalog_source"], "backend")
        before = list(self.order.cart)
        with patch.dict(os.environ, {"MENU_API_URL": "http://backend/menus"}), patch.object(order_ai.httpx, "get", side_effect=httpx.ConnectError("offline")):
            result = self.send(interpretation(op("clear")))
        self.assertEqual(result["error"], "menu_unavailable")
        self.assertEqual(result["items"], [])
        self.assertEqual(self.order.cart, before)

    def test_items_pass_actual_backend_validation(self):
        result = self.send(interpretation(
            op("add", "아메리카노", 2, temperature="ICE", size="Regular", shots=0),
            op("add", "카페 라떼", 1, temperature="HOT", size="Large", shots=1),
            op("add", "버터 크루아상", 1)))
        backend = Path(__file__).resolve().parents[2] / "backend" / "src" / "services" / "order.service.js"
        script = 'const s=require(process.argv[1]); const o=JSON.parse(process.argv[2]); console.log(JSON.stringify(s.calculateOrder(o)))'
        output = subprocess.check_output(["node", "-e", script, str(backend), json.dumps({"orderType": "TAKEOUT", "items": result["items"]})], text=True)
        self.assertEqual(json.loads(output)["totalPrice"], 15200)

    def test_text_endpoint_returns_items_without_submitting_order(self):
        self.client.responses.parse.return_value = SimpleNamespace(output_parsed=interpretation(op("add", "아메리카노", 1, temperature="HOT", size="Regular", shots=0)))
        order_ai.sessions.clear()
        self.addCleanup(order_ai.sessions.clear)
        with patch.object(order_ai, "OrderAI", return_value=self.order), TestClient(order_ai.app) as client:
            response = client.post("/ai/order/text", json={"session_id": "case1", "text": "따뜻한 아메리카노"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["result"]["items"][0]["menuId"], 1)
        self.assertTrue(response.json()["result"]["ready_for_quote"])

    def test_text_endpoint_keeps_session_through_checkout_and_requestions(self):
        self.client.responses.parse.side_effect = [SimpleNamespace(output_parsed=value) for value in [
            interpretation(op("add", "아메리카노", 2)),
            interpretation(checkout="start"),
            interpretation(op("update_options", temperature="ICE")),
            interpretation(op("update_options", size="Regular")),
            interpretation(op("update_options", shots=0)),
        ]]
        order_ai.sessions.clear()
        self.addCleanup(order_ai.sessions.clear)
        with patch.object(order_ai, "OrderAI", return_value=self.order), TestClient(order_ai.app) as client:
            results = []
            for text in ("아메리카노 두 잔", "결제하기", "아이스", "보통", "샷 추가 안 해요"):
                response = client.post("/ai/order/text", json={"session_id": "session1", "text": text})
                self.assertEqual(response.status_code, 200)
                results.append(response.json()["result"])
        self.assertEqual(results[1]["next_action"], "ask_clarification")
        self.assertEqual(results[-1]["next_action"], "request_quote")
        self.assertEqual(results[-1]["items"], [{"menuId": 1, "quantity": 2, "temperature": "ICE", "size": "Regular", "shots": 0}])


if __name__ == "__main__":
    unittest.main()
