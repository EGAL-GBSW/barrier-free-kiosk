const express = require("express");
const cors = require("cors");
const menus = require("./data/menus");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Barrier Free Kiosk API Server"
  });
});

const PORT = 3000;

app.get("/menus", (req, res) => {
  res.status(200).json(menus);
});

app.get("/menus/:id", (req, res) => {
  const menuId = Number(req.params.id);
  const menu = menus.find((item) => item.id === menuId);

  if (!menu) {
    return res.status(404).json({
      message: "메뉴를 찾을 수 없습니다."
    });
  }

  res.status(200).json(menu);
});

app.post("/orders", (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});