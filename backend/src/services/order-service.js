const { randomUUID } = require('node:crypto');
const menus = require('../data/menus');
const { HttpError } = require('../middlewares/error-handler');

function invalid(message) {
  throw new HttpError(400, 'INVALID_ORDER', message);
}

function createOrderService() {
  // DB 연결 전 개발용 저장소. 서버 종료 시 주문이 사라집니다.
  const orders = new Map();

  return {
    create(body) {
      if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
        invalid('items에는 주문 항목을 1~50개 넣어주세요.');
      }
      if (!['DINE_IN', 'TAKEOUT'].includes(body.orderType)) {
        invalid('orderType은 DINE_IN 또는 TAKEOUT이어야 합니다.');
      }
      const items = body.items.map((item) => {
        if (!item || !Number.isSafeInteger(item.menuId) || item.menuId < 1) invalid('menuId는 양의 정수여야 합니다.');
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) invalid('quantity는 1~99 사이의 정수여야 합니다.');
        const menu = menus.find((entry) => entry.id === item.menuId);
        if (!menu) throw new HttpError(404, 'MENU_NOT_FOUND', '존재하지 않는 메뉴입니다.');
        if (!menu.available) throw new HttpError(409, 'MENU_UNAVAILABLE', `${menu.name} 메뉴는 품절입니다.`);
        if (!menu.temperatures.includes(item.temperature)) invalid(`${menu.name}의 temperature는 ${menu.temperatures.join(' 또는 ')}이어야 합니다.`);
        return {
          menuId: menu.id,
          name: menu.name,
          temperature: item.temperature,
          quantity: item.quantity,
          unitPrice: menu.price,
          subtotal: menu.price * item.quantity,
        };
      });
      const order = {
        id: randomUUID(),
        orderType: body.orderType,
        status: 'RECEIVED',
        items,
        totalAmount: items.reduce((sum, item) => sum + item.subtotal, 0),
        currency: 'KRW',
        createdAt: new Date().toISOString(),
      };
      orders.set(order.id, order);
      return order;
    },
    get(id) {
      const order = orders.get(id);
      if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', '주문을 찾을 수 없습니다.');
      return order;
    },
  };
}

module.exports = { createOrderService };
