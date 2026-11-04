const { test } = require("node:test");
const assert = require("node:assert/strict");
const { calculateOrder } = require("../src/services/order.service");

const coffee = () => ({ menuId: 1, quantity: 2, temperature: "ICE" });
const order = (items = [coffee()], orderType = "TAKEOUT") => ({ orderType, items });
const rejects = (body, status = 400) => assert.throws(() => calculateOrder(body), (error) => error.status === status);

test("여러 메뉴와 옵션을 서버 가격으로 계산한다", () => {
  const result = calculateOrder(order([
    { ...coffee(), size: "Large", shots: 2, unitPrice: 1 },
    { menuId: 7, quantity: 1 }
  ]));
  assert.equal(result.items[0].unitPrice, 4700);
  assert.equal(result.items[0].totalPrice, 9400);
  assert.equal(result.items[1].temperature, null);
  assert.equal(result.totalPrice, 15900);
  assert.equal(result.totalQuantity, 3);
  assert.equal(result.orderType, "TAKEOUT");
});

test("기본 옵션과 매장 주문을 처리한다", () => {
  const result = calculateOrder(order(undefined, "DINE_IN"));
  assert.equal(result.items[0].size, "Regular");
  assert.equal(result.items[0].shots, 0);
  assert.equal(result.totalPrice, 6000);
  assert.equal(result.orderType, "DINE_IN");
});

test("비정상 주문 본문과 주문 유형을 거부한다", () => {
  for (const body of [null, [], {}, order([]), order(Array(51).fill(coffee())), order(undefined, "DELIVERY"), { menuId: 1, quantity: 2 }]) rejects(body);
});

test("잘못된 메뉴 번호와 수량을 거부한다", () => {
  for (const menuId of ["1", 0, -1, 1.5]) rejects(order([{ ...coffee(), menuId }]));
  rejects(order([{ ...coffee(), menuId: 999 }]), 404);
  for (const quantity of [0, -1, 100, 1.5, "2", null]) rejects(order([{ ...coffee(), quantity }]));
  rejects(order([null]));
});

test("메뉴별 온도를 검증한다", () => {
  rejects(order([{ menuId: 5, quantity: 1, temperature: "HOT" }]));
  rejects(order([{ menuId: 1, quantity: 1 }]));
  rejects(order([{ menuId: 7, quantity: 1, temperature: "ICE" }]));
  for (const temperature of [undefined, null, ""]) {
    assert.equal(calculateOrder(order([{ menuId: 7, quantity: 1, temperature }])).items[0].temperature, null);
  }
});

test("사이즈와 샷 제한을 검증한다", () => {
  rejects(order([{ ...coffee(), size: "XL" }]));
  rejects(order([{ menuId: 7, quantity: 1, size: "Large" }]));
  for (const shots of [-1, 3, 0.5, "1", null]) rejects(order([{ ...coffee(), shots }]));
  rejects(order([{ menuId: 4, quantity: 1, temperature: "ICE", shots: 1 }]));
  const result = calculateOrder(order([{ menuId: 5, quantity: 1, temperature: "ICE", size: "Large" }]));
  assert.equal(result.totalPrice, 6200);
});
