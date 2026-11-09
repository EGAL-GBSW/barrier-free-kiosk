require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const db = require("./db");
const menuRoutes = require("./routes/menu.routes");
const orderRoutes = require("./routes/order.routes");
const paymentRoutes = require("./routes/payment.routes");
const { createVoiceRouter } = require("./routes/voice.routes");
const { OrderError } = require("./services/order.service");

const app = express();
app.use(cors());
app.use(express.json({ limit: "32kb" }));

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Barrier Free Kiosk API Server" });
});
app.use("/menus", menuRoutes);
app.use("/orders", orderRoutes);
app.use("/payments", paymentRoutes);
app.use("/voice", createVoiceRouter());

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof OrderError) return res.status(error.status).json({ message: error.message });
  if (error.type === "entity.parse.failed") return res.status(400).json({ message: "올바른 JSON을 보내주세요." });
  if (error.type === "entity.too.large") return res.status(413).json({ message: "요청 본문이 너무 큽니다." });
  console.error(error.name, error.code || "");
  res.status(500).json({ message: "서버에서 요청을 처리하지 못했습니다." });
});

async function start() {
  if (!process.env.DATABASE_URL) throw new Error("backend/.env에 DATABASE_URL을 설정해주세요.");
  await db.$connect();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, "127.0.0.1", () => console.log(`Server running on http://127.0.0.1:${port}`));
}

if (require.main === module) {
  start().catch(async (error) => {
    console.error(error.message);
    await db.$disconnect();
    process.exitCode = 1;
  });
}

module.exports = app;
