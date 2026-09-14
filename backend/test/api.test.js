const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

const validOrder = () => ({ orderType: 'TAKEOUT', items: [{ menuId: 1, quantity: 2, temperature: 'ICE' }] });

test('서버 상태와 메뉴 목록/상세를 조회한다', async () => {
  const app = createApp();
  const health = await request(app).get('/health').expect(200);
  assert.equal(health.body.status, 'OK');
  const list = await request(app).get('/menus').expect(200);
  assert.equal(list.body.data.length, 4);
  const detail = await request(app).get('/menus/1').expect(200);
  assert.equal(detail.body.data.name, '아메리카노');
  await request(app).get('/menus/999').expect(404);
  for (const id of ['1abc', '0', '-1', '1.5', '9007199254740992']) {
    await request(app).get(`/menus/${id}`).expect(400);
  }
});

test('서버 가격으로 여러 메뉴의 합계를 계산하고 저장된 주문을 반환한다', async () => {
  const app = createApp();
  const body = validOrder();
  body.totalAmount = 1;
  body.items[0].unitPrice = 1;
  body.items.push({ menuId: 2, quantity: 1, temperature: 'HOT' });
  const response = await request(app).post('/orders').send(body).expect(201);
  assert.equal(response.body.data.totalAmount, 10000);
  assert.equal(response.body.data.items[0].unitPrice, 3000);
  assert.equal(response.body.data.status, 'RECEIVED');
  const saved = await request(app).get(response.headers.location).expect(200);
  assert.deepEqual(saved.body, response.body);
  await request(app).get('/orders/missing').expect(404);
});

test('빈 주문과 잘못된 주문 유형을 거부한다', async () => {
  const app = createApp();
  for (const body of [{}, { ...validOrder(), items: [] }, { ...validOrder(), items: Array(51).fill(validOrder().items[0]) }, { ...validOrder(), orderType: 'DELIVERY' }]) {
    const response = await request(app).post('/orders').send(body).expect(400);
    assert.equal(response.body.error.code, 'INVALID_ORDER');
  }
  await request(app).post('/orders').expect(400);
});

test('잘못된 수량, 메뉴 ID, 온도와 품절을 검증한다', async () => {
  const app = createApp();
  for (const quantity of [0, -1, 1.5, 100, '2', null]) {
    const body = validOrder();
    body.items[0].quantity = quantity;
    await request(app).post('/orders').send(body).expect(400);
  }
  for (const [item, status, code] of [
    [null, 400, 'INVALID_ORDER'],
    [{ menuId: '1', quantity: 1, temperature: 'ICE' }, 400, 'INVALID_ORDER'],
    [{ menuId: 999, quantity: 1, temperature: 'ICE' }, 404, 'MENU_NOT_FOUND'],
    [{ menuId: 4, quantity: 1, temperature: 'ICE' }, 409, 'MENU_UNAVAILABLE'],
    [{ menuId: 3, quantity: 1, temperature: 'HOT' }, 400, 'INVALID_ORDER'],
  ]) {
    const response = await request(app).post('/orders').send({ orderType: 'DINE_IN', items: [item] }).expect(status);
    assert.equal(response.body.error.code, code);
  }
});

test('메모리 저장소는 앱 인스턴스별로 분리된다', async () => {
  const response = await request(createApp()).post('/orders').send(validOrder()).expect(201);
  await request(createApp()).get(response.headers.location).expect(404);
});

test('잘못된 JSON, 과도한 요청 크기, 없는 경로도 JSON 오류를 반환한다', async () => {
  const app = createApp();
  const malformed = await request(app).post('/orders').set('Content-Type', 'application/json').send('{').expect(400);
  assert.equal(malformed.body.error.code, 'INVALID_JSON');
  const large = await request(app).post('/orders').send({ text: 'a'.repeat(33000) }).expect(413);
  assert.equal(large.body.error.code, 'PAYLOAD_TOO_LARGE');
  const missing = await request(app).get('/missing').expect(404);
  assert.equal(missing.body.error.code, 'NOT_FOUND');
});
