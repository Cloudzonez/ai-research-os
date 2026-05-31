import { Router } from "express";
import Dashboard from "../models/Dashboard.js";
import { authRequired } from "../middleware/auth.js";
import { chat } from "../services/deepseek.js";

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
    const prompt = locale === "zh"
      ? `你是一个数据可视化专家。根据以下 JSON 数据生成一个完整的、美观的 HTML 仪表盘页面。要求：
1. 使用内联 CSS（不使用外部样式表）
2. 包含合适的图表、卡片、表格等可视化元素
3. 使用现代设计风格（圆角、阴影、渐变）
4. 响应式布局
5. 只返回完整的 HTML 代码（从 <!DOCTYPE html> 开始），不要包含任何解释

JSON 数据：
${JSON.stringify(parsed, null, 2)}

仪表盘标题：${name}
描述：${description || ""}`

      : `You are a data visualization expert. Generate a complete, beautiful HTML dashboard page from the following JSON data. Requirements:
1. Use inline CSS (no external stylesheets)
2. Include appropriate charts, cards, tables, and other visualization elements
3. Use modern design style (rounded corners, shadows, gradients)
4. Responsive layout
5. Return ONLY the complete HTML code (starting with <!DOCTYPE html>), no explanations

JSON data:
${JSON.stringify(parsed, null, 2)}

Dashboard title: ${name}
Description: ${description || ""}`;

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
