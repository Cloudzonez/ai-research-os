import { Router } from "express";
import Dashboard from "../models/Dashboard.js";
import { authRequired } from "../middleware/auth.js";
import { chat } from "../services/deepseek.js";
import { buildDashboardPrompt } from "../prompts/dashboards.js";

const router = Router();

// GET all dashboards for the current user
router.get("/", authRequired, async (req, res) => {
  try {
    const dashboards = await Dashboard.find({
      $or: [
        { owner: req.user._id },
        { sharing: { $in: ["school", "university"] } },
      ],
    })
      .sort({ createdAt: -1 })
      .populate("owner", "name email")
      .lean();
    res.json({ dashboards });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single dashboard
router.get("/:id", authRequired, async (req, res) => {
  try {
    const dashboard = await Dashboard.findById(req.params.id)
      .populate("owner", "name email")
      .lean();
    if (!dashboard) return res.status(404).json({ error: "Dashboard not found" });
    res.json({ dashboard });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create dashboard — generates HTML from JSON data via DeepSeek
router.post("/", authRequired, async (req, res) => {
  try {
    const { name, description, jsonData, locale } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    if (!jsonData) return res.status(400).json({ error: "jsonData required" });

    // Validate JSON
    let parsed;
    try {
      parsed = JSON.parse(jsonData);
    } catch {
      return res.status(400).json({ error: "Invalid JSON data" });
    }

    // Generate HTML using DeepSeek
    const prompt = buildDashboardPrompt(parsed, name, description, locale);

    let htmlContent = "";
    try {
      const result = await chat(
        [{ role: "user", content: prompt }],
        locale || "zh",
        { temperature: 0.3, maxTokens: 8000 }
      );
      htmlContent = result.content || "";

      // Extract HTML from the response (strip markdown code fences if present)
      const htmlMatch = htmlContent.match(/```html\s*([\s\S]*?)```/);
      if (htmlMatch) htmlContent = htmlMatch[1].trim();
      else {
        const doctypeMatch = htmlContent.match(/<!DOCTYPE html>[\s\S]*/i);
        if (doctypeMatch) htmlContent = doctypeMatch[0];
      }
    } catch (err) {
      console.error("HTML generation failed:", err.message);
      return res.status(500).json({ error: "AI HTML generation failed: " + err.message });
    }

    const dashboard = await Dashboard.create({
      name,
      description: description || "",
      jsonData,
      htmlContent,
      owner: req.user._id,
      sharing: "school",
    });

    res.status(201).json({ dashboard: dashboard.toObject() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE dashboard
router.delete("/:id", authRequired, async (req, res) => {
  try {
    const dashboard = await Dashboard.findById(req.params.id);
    if (!dashboard) return res.status(404).json({ error: "Dashboard not found" });

    if (dashboard.owner?.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to delete this dashboard" });
    }

    await Dashboard.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
