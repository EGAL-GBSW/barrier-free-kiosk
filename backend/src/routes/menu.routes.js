const express = require("express");
const menus = require("../data/menus");

const router = express.Router();

// 전체 또는 카테고리별 메뉴 조회
router.get("/", (req, res) => {
  const category = req.query.category;

  if (category === undefined) {
    return res.status(200).json(menus);
  }

  const allowedCategories = [
    "coffee",
    "noncoffee",
    "frappe",
    "bakery"
  ];

  if (!allowedCategories.includes(category)) {
    return res.status(400).json({
      message: "지원하지 않는 카테고리입니다."
    });
  }

  const filteredMenus = menus.filter((menu) => {
    return menu.category === category;
  });

  res.status(200).json(filteredMenus);
});

// 메뉴 하나 조회
router.get("/:id", (req, res) => {
  const menuId = Number(req.params.id);
  const menu = menus.find((item) => item.id === menuId);

  if (!menu) {
    return res.status(404).json({
      message: "메뉴를 찾을 수 없습니다."
    });
  }

  res.status(200).json(menu);
});

module.exports = router;