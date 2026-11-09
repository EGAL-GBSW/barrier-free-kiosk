const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const { createVoiceRouter } = require("../src/routes/voice.routes");

test("음성 재질문·견적 신호와 같은 세션을 유지하고, 종료할 때만 세션을 삭제한다", async () => {
  const calls = [];
  const app = express();
  app.use(express.json());
  app.use("/voice", createVoiceRouter({
    getBaseUrl: () => "http://ai.test:8000",
    fetchAi: async (url, init) => {
      if (init.method === "DELETE") {
        calls.push([url, init.method]);
        return Response.json({});
      }
      const body = JSON.parse(init.body);
      calls.push([url, init.method, body]);
      const quote = body.text === "결제해 주세요";
      const result = {
        next_action: quote ? "request_quote" : "ask_clarification",
        ready_for_quote: quote,
        message: quote ? "주문 내용을 확인해 주세요." : "사이즈를 말씀해 주세요.",
        cart: [{ menu: "아메리카노", quantity: 2 }],
        items: quote ? [{ menuId: 1, quantity: 2, temperature: "ICE", size: "Regular", shots: 0 }] : []
      };
      return Response.json({ status: "success", session_id: body.session_id, recognized_text: body.text, result });
    }
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/voice`;
  const id = "a1e18ab7-507f-4ae8-81b0-85083c3d478a";
  const post = (body) => fetch(base + "/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  try {
    assert.equal((await post({ text: "아메리카노 두 잔" })).status, 400);
    assert.equal(calls.length, 0);
    const first = await post({ session_id: id, text: "아메리카노 두 잔" });
    assert.equal(first.status, 200);
    assert.equal((await first.json()).result.next_action, "ask_clarification");
    const quote = await post({ session_id: id, text: "결제해 주세요" });
    assert.equal(quote.status, 200);
    const data = await quote.json();
    assert.equal(data.session_id, id);
    assert.equal(data.result.next_action, "request_quote");
    assert.equal(data.result.ready_for_quote, true);
    assert.deepEqual(data.result.items[0], { menuId: 1, quantity: 2, temperature: "ICE", size: "Regular", shots: 0 });
    assert.deepEqual(calls.map(([url, method, body]) => [url, method, body.session_id]), [
      ["http://ai.test:8000/ai/order/text", "POST", id], ["http://ai.test:8000/ai/order/text", "POST", id]
    ]);
    assert.equal((await fetch(base + "/sessions/" + id, { method: "DELETE" })).status, 204);
    assert.deepEqual(calls[2], ["http://ai.test:8000/ai/order/" + id, "DELETE"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
