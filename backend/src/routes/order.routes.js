const express = require("express");
const { calculateOrder, OrderError } = require("../services/order.service");

const router = express.Router();

router.post("/", (req, res, next) => {
  try {
    const order = calculateOrder(req.body);
    res.status(200).json({ message: "주문 금액을 계산했습니다.", ...order });
  } catch (error) {
    if (error instanceof OrderError) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
});

module.exports = router;
