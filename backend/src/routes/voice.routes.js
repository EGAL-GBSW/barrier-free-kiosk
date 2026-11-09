const express = require("express");
const sessionPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

function getEndpoint(getBaseUrl) {
  const base = new URL(getBaseUrl());
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error();
  return base.href.replace(/\/+$/, "") + "/ai/order";
}

function createVoiceRouter({ fetchAi = fetch, getBaseUrl = () => process.env.AI_ORDER_BASE_URL } = {}) {
  const router = express.Router();
  router.post("/analyze", async (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const sessionId = req.body?.session_id;
    if (typeof sessionId !== "string" || !sessionPattern.test(sessionId)) {
      return res.status(400).json({ message: "음성 주문 세션을 다시 시작해 주세요." });
    }
    if (!text || text.length > 2000) {
      return res.status(400).json({ message: "인식된 문장을 1~2000자로 보내주세요." });
    }

    let endpoint;
    try {
      endpoint = getEndpoint(getBaseUrl);
    } catch {
      return res.status(503).json({ message: "백엔드에 AI 주문 서버 주소가 설정되지 않았습니다." });
    }
    try {
      const response = await fetchAi(endpoint + "/text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, text }), redirect: "error",
        signal: AbortSignal.timeout(65000)
      });
      if (!response.ok) {
        return res.status(502).json({ message: "AI 서버에서 주문 결과를 받지 못했어요." });
      }
      const data = await response.json();
      if (data?.session_id !== sessionId || typeof data.recognized_text !== "string" ||
          !data.recognized_text.trim() || !Array.isArray(data.result?.cart) ||
          !Array.isArray(data.result?.items) || typeof data.result.ready_for_quote !== "boolean" ||
          typeof data.result.next_action !== "string" || typeof data.result.message !== "string") {
        return res.status(502).json({ message: "AI 응답 형식을 확인할 수 없어요." });
      }
      if (data.status !== "success" || data.result.error) {
        return res.status(422).json({ message: data.result.message || "음성 주문을 분석하지 못했어요." });
      }
      res.json({
        session_id: sessionId,
        recognized_text: data.recognized_text,
        result: data.result
      });
    } catch (error) {
      const timeout = error.name === "TimeoutError";
      res.status(timeout ? 504 : 502).json({
        message: timeout ? "AI 응답이 늦어졌어요. 다시 말씀해 주세요." : "AI 주문 서버에 연결하지 못했어요."
      });
    }
  });
  router.delete("/sessions/:id", async (req, res) => {
    if (!sessionPattern.test(req.params.id)) return res.sendStatus(400);
    try {
      const response = await fetchAi(getEndpoint(getBaseUrl) + "/" + req.params.id, {
        method: "DELETE", redirect: "error", signal: AbortSignal.timeout(3000)
      });
      if (!response.ok && response.status !== 404) return res.sendStatus(502);
      res.sendStatus(204);
    } catch {
      res.sendStatus(502);
    }
  });
  return router;
}

module.exports = { createVoiceRouter };
