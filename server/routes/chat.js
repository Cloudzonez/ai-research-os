import { Router } from "express";
import { routeChat, routeChatStream } from "../services/aiRouter.js";
import Message from "../models/Message.js";
import ChatSession from "../models/ChatSession.js";
import { createApproval } from "../middleware/approval.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// ── Streaming chat endpoint (SSE) ──────────────────────────────
router.post("/stream", authRequired, async (req, res) => {
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
    const sid = sessionId || "default";
    const userId = req.user?._id;

    // Save user message
    const userMsg = await Message.create({
      role: "user", kind: "general", text,
      sessionId: sid, userId,
    });

    // Auto-title: if this is the first message in a real session, set title from user text
    if (sid !== "default") {
      try {
        const msgCount = await Message.countDocuments({ sessionId: sid });
        if (msgCount === 1) {
          const autoTitle = text.slice(0, 50) + (text.length > 50 ? "..." : "");
          await ChatSession.findByIdAndUpdate(sid, { title: autoTitle });
        }
      } catch {}
    }

    // Stream the AI response with intermediate steps
    const result = await routeChatStream(text, locale || "zh", {
      userId,
      sessionId: sid,
      paperId,
      onStep: (step, data) => send("step", { step, ...data }),
      onToken: (token) => send("token", { token }),
    });

    // Save assistant message
    const assistantMsg = await Message.create({
      role: "assistant",
      kind: result.kind,
      text: result.text,
      sessionId: sid, userId,
      contextBundle: result.contextBundle,
    });

    // Update session's updatedAt
    if (sid !== "default") {
      try { await ChatSession.findByIdAndUpdate(sid, { updatedAt: new Date() }); } catch {}
    }

    // Log action
    await createApproval({
      action: "chat",
      model: result.model || "deepseek-v4-pro",
      inputText: text,
      outputText: result.text,
      tokensUsed: result.tokensUsed || 0,
      kind: result.kind,
      sessionId: sid,
      userId,
      riskLevel: "low",
    });

    // Send final result with side effects
    send("done", {
      kind: result.kind,
      text: result.text,
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
router.post("/", authRequired, async (req, res) => {
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

router.get("/messages", authRequired, async (req, res) => {
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
