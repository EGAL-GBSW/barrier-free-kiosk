const express = require("express");
const db = require("../db");

const router = express.Router();
const categories = ["coffee", "noncoffee", "frappe", "bakery"];

router.get("/", async (req, res) => {
  const { category } = req.query;
  if (category !== undefined && !categories.includes(category)) {
    return res.status(400).json({ message: "지원하지 않는 카테고리입니다." });
  }

  const menus = await db.menu.findMany({
    where: category === undefined ? {} : { category },
    orderBy: { id: "asc" }
  });
  res.json(menus);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const menu = Number.isInteger(id) && id > 0 && id <= 2147483647
    ? await db.menu.findUnique({ where: { id } })
    : null;
  if (!menu) return res.status(404).json({ message: "메뉴를 찾을 수 없습니다." });
  res.json(menu);
});

module.exports = router;
