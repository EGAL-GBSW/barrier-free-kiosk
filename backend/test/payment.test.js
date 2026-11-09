const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createPaymentService } = require("../src/services/payment.service");

const orderId = "c01f9707-396b-4d7d-9499-e584bf8bf7a2";
const paymentKey = "mock_payment_key";
const input = { orderId, paymentKey, amount: 8400 };
const done = { orderId, paymentKey, totalAmount: 8400, status: "DONE" };

function fixture(respond, initial = {}) {
  const order = { id: orderId, status: "PENDING_PAYMENT", totalPrice: 8400, paymentKey: null, ...initial };
  const calls = [];
  const db = { order: {
    findUnique: async () => ({ ...order }),
    updateMany: async ({ where, data }) => {
      if (order.status !== where.status ||
          (where.paymentKey !== undefined && order.paymentKey !== where.paymentKey) ||
          (where.OR && !where.OR.some((candidate) => candidate.paymentKey === order.paymentKey))) return { count: 0 };
      Object.assign(order, data);
      return { count: 1 };
    }
  } };
  const service = createPaymentService(db, {
    getSecret: () => "test_mock",
    providerFetch: async (url, init) => {
      calls.push({ url, init });
      return respond(url);
    }
  });
  return { service, order, calls };
}

test("DB 금액과 다른 승인 요청은 토스 호출 전에 거부한다", async () => {
  const { service, calls } = fixture(() => Response.json(done));
  await assert.rejects(service.confirm({ ...input, amount: 1 }), { status: 400 });
  assert.equal(calls.length, 0);
});

test("승인 완료를 저장하고 동일한 키의 재승인에는 토스를 다시 호출하지 않는다", async () => {
  const { service, order, calls } = fixture(() => Response.json(done));
  assert.deepEqual(await service.confirm(input), { orderId, status: "PAID" });
  assert.deepEqual(await service.confirm(input), { orderId, status: "PAID" });
  assert.equal(order.status, "PAID");
  assert.ok(order.paidAt instanceof Date);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers["Idempotency-Key"], orderId);
  assert.deepEqual(JSON.parse(calls[0].init.body), input);
  await assert.rejects(service.confirm({ ...input, paymentKey: "different" }), { status: 409 });
});

test("승인 응답이 주문과 다르거나 완료 상태가 아니면 PAID로 기록하지 않는다", async () => {
  for (const payment of [{ ...done, totalAmount: 1 }, { ...done, paymentKey: "different" }, { ...done, status: "WAITING_FOR_DEPOSIT" }]) {
    const { service, order } = fixture(() => Response.json(payment));
    await assert.rejects(service.confirm(input), { status: 502 });
    assert.equal(order.status, "PENDING_PAYMENT");
  }
});

test("이미 승인된 결제는 토스에서 조회해 완료 상태를 복구한다", async () => {
  const { service, calls } = fixture((url) => url.endsWith("/confirm")
    ? Response.json({ code: "ALREADY_PROCESSED_PAYMENT" }, { status: 400 })
    : Response.json(done));
  assert.deepEqual(await service.confirm(input), { orderId, status: "PAID" });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].url.endsWith("/" + paymentKey));
});

test("결제 없이 접수한 주문에는 결제 승인을 요청할 수 없다", async () => {
  const { service, calls } = fixture(() => Response.json(done), { status: "RECEIVED" });
  await assert.rejects(service.confirm(input), { status: 409 });
  assert.equal(calls.length, 0);
});
