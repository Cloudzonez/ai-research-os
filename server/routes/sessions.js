import { Router } from "express";
import ChatSession from "../models/ChatSession.js";
import Message from "../models/Message.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// ── List all sessions for current user ──────────────────────────
router.get("/", authRequired, async (req, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create a new chat session ───────────────────────────────────
router.post("/", authRequired, async (req, res) => {
  try {
    const { title } = req.body;
    const session = await ChatSession.create({
      userId: req.user._id,
      title: title || "New Chat",
    });
    res.status(201).json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Rename a session ────────────────────────────────────────────
router.patch("/:id", authRequired, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Title required" });

    const session = await ChatSession.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Toggle mark/bookmark ────────────────────────────────────────
router.patch("/:id/mark", authRequired, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ error: "Session not found" });

    session.isMarked = !session.isMarked;
    await session.save();
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Toggle share ────────────────────────────────────────────────
router.patch("/:id/share", authRequired, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ error: "Session not found" });

    session.isShared = !session.isShared;
    if (session.isShared) {
      session.generateShareToken();
    }
    await session.save();
    res.json({ session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete a session + all its messages ─────────────────────────
router.delete("/:id", authRequired, async (req, res) => {
  try {
    const session = await ChatSession.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ error: "Session not found" });

    await Message.deleteMany({ sessionId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get messages for a session ──────────────────────────────────
router.get("/:id/messages", authRequired, async (req, res) => {
  try {
    const session = await ChatSession.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const messages = await Message.find({ sessionId: req.params.id })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ messages, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Public: view shared conversation (no auth) ──────────────────
router.get("/shared/:token", async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      shareToken: req.params.token,
      isShared: true,
    }).lean();
    if (!session) return res.status(404).json({ error: "Shared conversation not found" });

    const messages = await Message.find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ session, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
