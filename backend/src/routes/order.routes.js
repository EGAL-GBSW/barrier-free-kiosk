const express = require("express");
const db = require("../db");
const { calculateOrder } = require("../services/order.service");

const router = express.Router();
const includeItems = { items: { orderBy: { id: "asc" } } };
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

function publicOrder(order) {
  const { id, items, ...details } = order;
  return {
    orderId: id,
    ...details,
    items: items.map(({ id, orderId, ...item }) => item)
  };
}

router.post("/quote", async (req, res) => {
  const quote = calculateOrder(req.body, await db.menu.findMany());
  res.json({ message: "주문 금액을 계산했습니다.", ...quote });
});

router.post("/", async (req, res) => {
  const { items, ...details } = calculateOrder(req.body, await db.menu.findMany());
  // Prisma의 중첩 생성은 주문과 모든 품목을 한 트랜잭션으로 저장합니다.
  const order = await db.order.create({
    data: { ...details, items: { create: items } },
    include: includeItems
  });
  res.location(`/orders/${order.id}`).status(201).json(publicOrder(order));
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const order = uuid.test(id)
    ? await db.order.findUnique({ where: { id }, include: includeItems })
    : null;
  if (!order) return res.status(404).json({ message: "주문을 찾을 수 없습니다." });
  res.json(publicOrder(order));
});

module.exports = router;
