import { Router } from "express";
import { routeChat, routeChatStream } from "../services/aiRouter.js";
import Message from "../models/Message.js";
import { createApproval } from "../middleware/approval.js";
import { authOptional } from "../middleware/auth.js";

const router = Router();

// ── Streaming chat endpoint (SSE) ──────────────────────────────
router.post("/stream", authOptional, async (req, res) => {
  const { text, locale, sessionId, paperId } = req.body;
  if (!text) return res.status(400).json({ error: "Text required" });

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Save user message
    const userMsg = await Message.create({
      role: "user", kind: "general", text,
      sessionId: sessionId || "default",
    });

    // Stream the AI response with intermediate steps
    const result = await routeChatStream(text, locale || "zh", {
      userId: req.user?._id,
      sessionId: sessionId || "default",
      paperId,
      onStep: (step, data) => send("step", { step, ...data }),
      onToken: (token) => send("token", { token }),
    });

    // Save assistant message
    const assistantMsg = await Message.create({
      role: "assistant",
      kind: result.kind,
      text: result.text,
      sessionId: sessionId || "default",
      contextBundle: result.contextBundle,
    });

    // Log action
    await createApproval({
      action: "chat",
      model: result.model || "deepseek-v4-pro",
      inputText: text,
      outputText: result.text,
      tokensUsed: result.tokensUsed || 0,
      kind: result.kind,
      sessionId: sessionId || "default",
      userId: req.user?._id,
      riskLevel: "low",
    });

    // Send final result with side effects
    send("done", {
      kind: result.kind,
      tokensUsed: result.tokensUsed,
      contextBundle: result.contextBundle,
      sideEffects: result.sideEffects || {},
    });
  } catch (err) {
    console.error("Stream chat error:", err);
    send("error", { error: err.message || "Chat failed" });
  } finally {
    res.end();
  }
});

// ── Non-streaming chat endpoint (original) ─────────────────────
router.post("/", authOptional, async (req, res) => {
  try {
    const { text, locale, sessionId, paperId } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });

    const userMsg = await Message.create({
      role: "user",
      kind: "general",
      text,
      sessionId: sessionId || "default",
    });

    const response = await routeChat(text, locale || "zh", {
      userId: req.user?._id,
      sessionId: sessionId || "default",
      paperId,
    });

    const assistantMsg = await Message.create({
      role: "assistant",
      kind: response.kind,
      text: response.text,
      sessionId: sessionId || "default",
      contextBundle: response.contextBundle,
    });

    await createApproval({
      action: "chat",
      model: response.model || "deepseek-v4-pro",
      inputText: text,
      outputText: response.text,
      tokensUsed: response.tokensUsed || 0,
      kind: response.kind,
      sessionId: sessionId || "default",
      userId: req.user?._id,
      riskLevel: response.quotaExceeded ? "high" : "low",
    });

    res.json({
      message: {
        role: "assistant",
        kind: response.kind,
        text: response.text,
        createdAt: assistantMsg.createdAt,
        contextBundle: response.contextBundle,
      },
      sideEffects: response.sideEffects || {},
      quotaExceeded: response.quotaExceeded || false,
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message || "Chat failed" });
  }
});

router.get("/messages", async (req, res) => {
  try {
    const { sessionId } = req.query;
    const messages = await Message.find(sessionId ? { sessionId } : {})
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
