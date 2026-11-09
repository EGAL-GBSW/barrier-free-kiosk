const express = require("express");
const db = require("../db");
const { calculateOrder, OrderError } = require("../services/order.service");
const { createPaymentService, testSecret } = require("../services/payment.service");

const router = express.Router();
const payments = createPaymentService(db);

router.post("/orders", async (req, res) => {
  testSecret();
  const { items, ...details } = calculateOrder(req.body, await db.menu.findMany());
  if (req.body.expectedAmount !== details.totalPrice) {
    throw new OrderError(409, "화면의 금액과 서버의 금액이 달라요. 메뉴 가격을 확인해 주세요.");
  }
  const order = await db.order.create({
    data: { ...details, status: "PENDING_PAYMENT", items: { create: items } }
  });
  const orderName = items[0].menuName + (details.totalQuantity > 1 ? ` 외 ${details.totalQuantity - 1}개` : "");
  res.status(201).json({ orderId: order.id, orderName, amount: order.totalPrice, status: order.status });
});

router.post("/confirm", async (req, res) => {
  res.json(await payments.confirm(req.body ?? {}));
});

module.exports = router;
