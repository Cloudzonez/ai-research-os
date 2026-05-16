import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { generateApp } from "../services/appFactory.js";
import { runInSandbox } from "../services/sandbox.js";
import GeneratedApp from "../models/GeneratedApp.js";
import GeneratedScript from "../models/GeneratedScript.js";
import CrawlerPlugin from "../models/CrawlerPlugin.js";
import AgentSpec from "../models/AgentSpec.js";
import ToolDefinition from "../models/ToolDefinition.js";
import ExecutableResearchObject from "../models/ExecutableResearchObject.js";

const router = Router();

// GET overview stats for Foundry workspace
router.get("/", authRequired, async (req, res) => {
  try {
    const [apps, scripts, crawlers, agents, tools, eros] = await Promise.all([
      GeneratedApp.countDocuments({ owner: req.user._id }),
      GeneratedScript.countDocuments({ owner: req.user._id }),
      CrawlerPlugin.countDocuments({ owner: req.user._id }),
      AgentSpec.countDocuments({ active: true }),
      ToolDefinition.countDocuments({ active: true }),
      ExecutableResearchObject.countDocuments({ owner: req.user._id }),
    ]);

    res.json({
      stats: { apps, scripts, crawlers, agents, tools, eros },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Apps ────────────────────────────────────────

router.get("/apps", authRequired, async (req, res) => {
  const apps = await GeneratedApp.find({
    $or: [{ owner: req.user._id }, { sharingScope: { $in: ["school", "university"] } }],
  })
    .sort({ createdAt: -1 })
    .populate("owner", "name email")
    .lean();
  res.json({ apps });
});

router.post("/apps/generate", authRequired, async (req, res) => {
  try {
    const { description, locale } = req.body;
    if (!description) return res.status(400).json({ error: "Description required" });

    const { app, template } = await generateApp(description, req.user._id, locale || "zh");
    res.status(201).json({ app, template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/apps/:id/publish", authRequired, async (req, res) => {
  const app = await GeneratedApp.findByIdAndUpdate(
    req.params.id,
    {
      approvalState: "pending",
      publishedUrl: `/apps/${req.params.id}`,
      $push: { auditLog: { action: "submitted_for_review", user: req.user._id, timestamp: new Date() } },
    },
    { new: true }
  );
  if (!app) return res.status(404).json({ error: "App not found" });
  res.json({ app });
});

// ─── Scripts ─────────────────────────────────────

router.get("/scripts", authRequired, async (req, res) => {
  const scripts = await GeneratedScript.find({
    $or: [{ owner: req.user._id }, { sharingScope: { $in: ["school", "university"] } }],
  })
    .sort({ createdAt: -1 })
    .populate("owner", "name email")
    .lean();
  res.json({ scripts });
});

router.post("/scripts/generate", authRequired, async (req, res) => {
  try {
    const { description, language, locale } = req.body;
    if (!description) return res.status(400).json({ error: "Description required" });

    const { chat } = await import("../services/deepseek.js");
    const prompt = `Generate a ${language || "JavaScript"} script for: "${description}". Return only code, no explanations. The script should be self-contained and runnable.`;

    const result = await chat([{ role: "user", content: prompt }], locale || "zh");
    let code = result.content;
    const codeMatch = result.content.match(/```(?:\w+)?\s*([\s\S]*?)```/);
    if (codeMatch) code = codeMatch[1].trim();

    const script = await GeneratedScript.create({
      title: description.slice(0, 80),
      language: language || "javascript",
      code,
      owner: req.user._id,
      sharingScope: "school",
      version: "1.0.0",
    });

    res.status(201).json({ script });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/scripts/:id/run", authRequired, async (req, res) => {
  try {
    const script = await GeneratedScript.findById(req.params.id);
    if (!script) return res.status(404).json({ error: "Script not found" });

    const result = await runInSandbox(script.code, {
      language: script.language,
      timeout: 30000,
    });

    script.sandboxResult = {
      status: result.status,
      output: result.output,
      error: result.error,
      duration: result.duration,
    };
    await script.save();

    res.json({ result: script.sandboxResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EROs ────────────────────────────────────────

router.get("/eros", authRequired, async (req, res) => {
  const eros = await ExecutableResearchObject.find({
    $or: [{ owner: req.user._id }, { sharingScope: { $in: ["school", "university"] } }],
  })
    .sort({ createdAt: -1 })
    .populate("owner", "name email")
    .lean();
  res.json({ eros });
});

router.post("/eros", authRequired, async (req, res) => {
  const ero = await ExecutableResearchObject.create({
    ...req.body,
    owner: req.user._id,
  });
  res.status(201).json({ ero });
});

// ─── Agent Specs & Tool Definitions ──────────────

router.get("/agents", authRequired, async (req, res) => {
  const agents = await AgentSpec.find({ active: true }).sort({ name: 1 }).lean();
  res.json({ agents });
});

router.get("/tools", authRequired, async (req, res) => {
  const tools = await ToolDefinition.find({ active: true }).sort({ name: 1 }).lean();
  res.json({ tools });
});

export default router;
