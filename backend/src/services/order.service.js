const defaultMenus = require("../data/menus");

class OrderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function invalid(message) {
  throw new OrderError(400, message);
}

function calculateItem(item, menus) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    invalid("주문 항목은 객체여야 합니다.");
  }
  const { menuId, quantity, temperature, size = "Regular", shots = 0 } = item;
  if (!Number.isSafeInteger(menuId) || menuId < 1) invalid("메뉴 번호는 양의 정수여야 합니다.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) invalid("수량은 1~99 사이의 정수여야 합니다.");

  const menu = menus.find((entry) => entry.id === menuId);
  if (!menu) throw new OrderError(404, "메뉴를 찾을 수 없습니다.");

  if (menu.temperatures.length > 0) {
    if (!menu.temperatures.includes(temperature)) {
      invalid(`이 메뉴의 온도는 ${menu.temperatures.join(", ")} 중에서 선택해주세요.`);
    }
  } else if (temperature !== undefined && temperature !== null && temperature !== "") {
    invalid("이 메뉴는 온도를 선택하지 않습니다.");
  }

  if (!["Regular", "Large"].includes(size)) invalid("사이즈는 Regular 또는 Large를 선택해주세요.");
  if (menu.category === "bakery" && size !== "Regular") invalid("베이커리는 기본 사이즈만 가능합니다.");
  if (!Number.isInteger(shots) || shots < 0 || shots > 2) invalid("샷 추가는 0~2 사이의 정수여야 합니다.");
  if (menu.category !== "coffee" && shots !== 0) invalid("샷 추가는 커피 메뉴에서만 가능합니다.");

  // 클라이언트가 보낸 가격을 사용하지 않고 서버 가격으로 계산합니다.
  const sizeExtraPrice = size === "Large" ? 700 : 0;
  const shotsExtraPrice = shots * 500;
  const unitPrice = menu.price + sizeExtraPrice + shotsExtraPrice;
  return {
    menuId: menu.id,
    menuName: menu.name,
    quantity,
    temperature: menu.temperatures.length ? temperature : null,
    size,
    shots,
    basePrice: menu.price,
    sizeExtraPrice,
    shotsExtraPrice,
    unitPrice,
    totalPrice: unitPrice * quantity
  };
}

function calculateOrder(body, menus = defaultMenus) {
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid("주문 데이터를 JSON 객체로 보내주세요.");
  if (!["DINE_IN", "TAKEOUT"].includes(body.orderType)) invalid("orderType은 DINE_IN 또는 TAKEOUT이어야 합니다.");
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) invalid("주문 항목은 1~50개여야 합니다.");

  const items = body.items.map((item) => calculateItem(item, menus));
  return {
    orderType: body.orderType,
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalPrice: items.reduce((sum, item) => sum + item.totalPrice, 0),
    currency: "KRW"
  };
}

module.exports = { calculateOrder, OrderError };
