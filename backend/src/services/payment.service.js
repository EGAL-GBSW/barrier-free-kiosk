const { OrderError } = require("./order.service");

function testSecret() {
  const secret = process.env.TOSS_TEST_SECRET_KEY;
  if (!secret?.startsWith("test_")) {
    throw new OrderError(503, "서버에 토스 테스트 시크릿 키를 설정해 주세요.");
  }
  return secret;
}

function createPaymentService(db, { providerFetch = fetch, getSecret = testSecret } = {}) {
  async function confirm({ orderId, paymentKey, amount } = {}) {
    if (typeof orderId !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(orderId) ||
        typeof paymentKey !== "string" || !paymentKey.trim() || paymentKey.length > 200 ||
        !Number.isSafeInteger(amount) || amount < 1) {
      throw new OrderError(400, "결제 정보가 올바르지 않습니다.");
    }

    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError(404, "주문을 찾을 수 없습니다.");
    if (order.totalPrice !== amount) throw new OrderError(400, "결제 금액이 주문 금액과 일치하지 않습니다.");
    if (order.paymentKey && order.paymentKey !== paymentKey) throw new OrderError(409, "다른 결제 정보로 승인할 수 없습니다.");
    if (order.status === "PAID") return { orderId, status: "PAID" };
    if (order.status !== "PENDING_PAYMENT") throw new OrderError(409, "결제 대기 중인 주문이 아닙니다.");
    const secret = getSecret();

    // 같은 주문은 최초로 접수된 결제 키로만 승인합니다.
    try {
      const claim = await db.order.updateMany({
        where: { id: orderId, status: "PENDING_PAYMENT", OR: [{ paymentKey: null }, { paymentKey }] },
        data: { paymentKey }
      });
      if (claim.count === 0) {
        const latest = await db.order.findUnique({ where: { id: orderId } });
        if (latest?.status === "PAID" && latest.paymentKey === paymentKey) return { orderId, status: "PAID" };
        throw new OrderError(409, "다른 결제 정보로 승인할 수 없습니다.");
      }
    } catch (error) {
      if (error.code === "P2002") throw new OrderError(409, "이미 다른 주문에 사용한 결제 정보입니다.");
      throw error;
    }

    const headers = { Authorization: `Basic ${Buffer.from(secret + ":").toString("base64")}` };
    async function call(path, init = {}) {
      try {
        const response = await providerFetch(`https://api.tosspayments.com/v1/payments/${path}`, {
          ...init, signal: AbortSignal.timeout(10000)
        });
        return { response, data: await response.json() };
      } catch {
        throw new OrderError(502, "결제 상태를 확인하지 못했습니다. 다시 확인해 주세요.");
      }
    }

    let result = await call("confirm", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", "Idempotency-Key": orderId },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });
    if (result.data?.code === "ALREADY_PROCESSED_PAYMENT") {
      result = await call(encodeURIComponent(paymentKey), { headers });
    }
    if (!result.response.ok) {
      throw new OrderError(502, "토스 승인 결과를 확인하지 못했습니다. 다시 확인해 주세요.");
    }
    const payment = result.data;
    if (payment?.status !== "DONE" || payment.orderId !== orderId ||
        payment.totalAmount !== amount || payment.paymentKey !== paymentKey) {
      throw new OrderError(502, "토스에서 완료된 결제를 확인하지 못했습니다.");
    }
    await db.order.updateMany({
      where: { id: orderId, status: "PENDING_PAYMENT", paymentKey },
      data: { status: "PAID", paidAt: new Date() }
    });
    return { orderId, status: "PAID" };
  }
  return { confirm };
}

module.exports = { createPaymentService, testSecret };
