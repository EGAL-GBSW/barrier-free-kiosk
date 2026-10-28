const express = require("express");
const menus = require("../data/menus");

const router = express.Router();

router.post("/", (req, res) => {
  const { menuId, quantity } = req.body ?? {};

  if (!Number.isInteger(menuId) || menuId < 1) {
    return res.status(400).json({
      message: "메뉴 번호는 양의 정수여야 합니다."
    });
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return res.status(400).json({
      message: "수량은 1~99 사이의 정수여야 합니다."
    });
  }

  const menu = menus.find((item) => item.id === menuId);

  if (!menu) {
    return res.status(404).json({
      message: "메뉴를 찾을 수 없습니다."
    });
  }

  const totalPrice = menu.price * quantity;

  res.status(200).json({
    message: "주문 금액을 계산했습니다.",
    menuId: menu.id,
    menuName: menu.name,
    quantity: quantity,
    totalPrice: totalPrice
  });
});

module.exports = router;