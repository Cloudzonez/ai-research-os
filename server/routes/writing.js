import { Router } from "express";
import { chat, parseResponse } from "../services/deepseek.js";
import AIAction from "../models/AIAction.js";
import { buildWritingPrompt } from "../prompts/writing.js";
import { authOptional } from "../middleware/auth.js";

const router = Router();

router.post("/generate", authOptional, async (req, res) => {
  try {
    const { locale, topic } = req.body;
    const l = locale || "zh";

    const prompt = buildWritingPrompt(topic, l);

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
