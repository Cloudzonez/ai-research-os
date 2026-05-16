import { Router } from "express";
import { chat, parseResponse } from "../services/deepseek.js";
import AIAction from "../models/AIAction.js";

const router = Router();

router.post("/generate", async (req, res) => {
  try {
    const { locale, topic } = req.body;
    const l = locale || "zh";

    const prompt = l === "zh"
      ? `请为以下研究主题生成一段约200字的related work草稿。主题：${topic || "AI赋能科研"}。请用中文，学术风格，引用研究领域。以 WRITE: 开头回复。`
      : `Generate a ~150-word related work draft for research topic: "${topic || "AI-empowered research"}". Academic style, cite research areas. Start reply with WRITE:`;

    const result = await chat([{ role: "user", content: prompt }], l);
    const { text } = parseResponse(result.content);

    await AIAction.create({
      action: "generate_draft",
      model: result.model || "deepseek-v4-pro",
      inputText: prompt,
      outputText: text,
      tokensUsed: result.tokensUsed || 0,
      kind: "write",
    });

    res.json({ draft: text, tokensUsed: result.tokensUsed });
  } catch (err) {
    console.error("Draft generation error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
