const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const express = require('express');
const cors = require('cors');
const menuRoutes = require('./routes/menus');
const orderRoutes = require('./routes/orders');
const { createOrderService } = require('./services/order-service');
const { HttpError, errorHandler } = require('./middlewares/error-handler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', (req, res) => res.json({ status: 'OK', message: 'Barrier Free Kiosk API Server' }));
  app.use('/menus', menuRoutes);
  app.use('/orders', orderRoutes(createOrderService()));
  app.use((req, res, next) => next(new HttpError(404, 'NOT_FOUND', '요청한 경로가 없습니다.')));
  app.use(errorHandler);
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT는 1~65535 사이의 정수여야 합니다.');
  const host = process.env.HOST || '127.0.0.1';
  createApp().listen(port, host, () => console.log(`Server running on http://${host}:${port}`));
}

module.exports = { createApp };
