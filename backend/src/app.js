const express = require("express");
const cors = require("cors");

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

const menus = [
  { id: 1, name: "아메리카노", price: 3000 },
  { id: 2, name: "카페라떼", price: 4000 },
  { id: 3, name: "아이스티", price: 3500 },
];

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});