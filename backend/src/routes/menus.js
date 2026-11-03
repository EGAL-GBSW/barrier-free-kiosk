const { Router } = require('express');
const menus = require('../data/menus');
const { HttpError } = require('../middlewares/error-handler');

const router = Router();
router.get('/', (req, res) => res.json({ data: menus }));
router.get('/:id', (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) {
    throw new HttpError(400, 'INVALID_MENU_ID', '메뉴 ID는 양의 정수여야 합니다.');
  }
  const menu = menus.find((entry) => entry.id === Number(req.params.id));
  if (!menu) throw new HttpError(404, 'MENU_NOT_FOUND', '메뉴를 찾을 수 없습니다.');
  res.json({ data: menu });
});

module.exports = router;
