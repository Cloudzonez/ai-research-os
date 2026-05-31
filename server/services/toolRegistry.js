import Tracker from "../models/Tracker.js";
import Paper from "../models/Paper.js";
import { enqueue } from "./queue.js";
import { buildContextBundle } from "./contextEngine.js";
import { getRiskLevel } from "../middleware/approval.js";
import { authRequired } from "../middleware/auth.js";
import { buildDraftSectionPrompt } from "../prompts/toolRegistry.js";

const tools = {};

export function registerTool(definition, handler) {
  tools[definition.name] = {
    definition: {
      name: definition.name,
      description: definition.description,
      inputSchema: definition.inputSchema || {},
      outputSchema: definition.outputSchema || {},
      riskLevel: definition.riskLevel || "low",
      permissionScope: definition.permissionScope || "authenticated",
    },
    handler,
  };
}

export function getTool(name) {
  return tools[name] || null;
}

export function listTools(options = {}) {
  const { permissionScope } = options;
  let list = Object.values(tools).map((t) => t.definition);
  if (permissionScope) {
    list = list.filter((t) => t.permissionScope === permissionScope || t.permissionScope === "public");
  }
  return list;
}

export async function executeTool(name, input, context = {}) {
  const tool = getTool(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  const startTime = Date.now();
  const result = await tool.handler(input, context);
  const duration = Date.now() - startTime;

  return {
    tool: name,
    input,
    result,
    duration,
    riskLevel: tool.definition.riskLevel,
    executedAt: new Date().toISOString(),
  };
}

// ─── Register all tools ────────────────────────────────────────

registerTool(
  {
    name: "create_tracker",
    description: "Create a new research paper tracker for a topic",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Research topic to track" },
        keywords: { type: "array", items: { type: "string" } },
        cadence: { type: "string", enum: ["Daily", "Weekly", "Monthly"] },
        sources: { type: "array", items: { type: "string" } },
      },
      required: ["topic"],
    },
    riskLevel: "low",
  },
  async (input, context) => {
    const tracker = await Tracker.create({
      name: input.topic.slice(0, 100),
      keywords: input.keywords || [input.topic],
      cadence: input.cadence || "Daily",
      sources: input.sources || ["arXiv", "OpenAlex", "Semantic Scholar"],
      signals: context.locale === "zh" ? ["高相关", "新论文"] : ["High relevance", "New papers"],
      subscribers: 1,
      lastRun: new Date(),
    });
    return { tracker: tracker.toObject() };
  }
);

registerTool(
  {
    name: "upload_paper_pdf",
    description: "Upload a PDF paper for parsing and analysis",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        base64Data: { type: "string", description: "Base64-encoded PDF data" },
      },
      required: ["title"],
    },
    riskLevel: "low",
  },
  async (input) => {
    const paper = await Paper.create({
      title: input.title,
      source: "PDF",
      status: "parsing",
      sharing: "school",
      tags: ["Uploaded"],
    });
    return { paper: paper.toObject() };
  }
);

registerTool(
  {
    name: "summarize_paper",
    description: "Generate an AI summary of a paper",
    inputSchema: {
      type: "object",
      properties: {
        paperId: { type: "string" },
      },
      required: ["paperId"],
    },
    riskLevel: "low",
  },
  async (input) => {
    const job = await enqueue("summarize_paper", { paperId: input.paperId });
    return { queued: true, jobId: job._id.toString() };
  }
);

registerTool(
  {
    name: "compare_papers",
    description: "Compare two or more papers",
    inputSchema: {
      type: "object",
      properties: {
        paperIds: { type: "array", items: { type: "string" } },
      },
      required: ["paperIds"],
    },
    riskLevel: "medium",
  },
  async (input) => {
    const papers = await Paper.find({ _id: { $in: input.paperIds } }).lean();
    return { papers, count: papers.length };
  }
);

registerTool(
  {
    name: "generate_research_board",
    description: "Generate a research board from trackers and papers",
    inputSchema: {
      type: "object",
      properties: {
        trackerIds: { type: "array", items: { type: "string" } },
      },
      required: ["trackerIds"],
    },
    riskLevel: "medium",
  },
  async (input) => {
    const trackers = await Tracker.find({ _id: { $in: input.trackerIds } }).lean();
    return { trackers, boardGenerated: true };
  }
);

registerTool(
  {
    name: "draft_paper_section",
    description: "Generate a draft section for a paper",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string" },
        section: { type: "string", description: "e.g., related_work, methods, introduction" },
      },
      required: ["topic"],
    },
    riskLevel: "low",
  },
  async (input) => {
    const { chat } = await import("./deepseek.js");
    const prompt = buildDraftSectionPrompt(input.section, input.topic);
    const result = await chat([{ role: "user", content: prompt }], "en");
    return { draft: result.content, tokensUsed: result.tokensUsed };
  }
);

registerTool(
  {
    name: "build_context_bundle",
    description: "Build a task-scoped context bundle from relevant papers",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        maxPapers: { type: "number" },
      },
      required: ["query"],
    },
    riskLevel: "low",
  },
  async (input, context) => {
    return buildContextBundle(input.query, {
      locale: context.locale || "zh",
      userId: context.userId,
      maxPapers: input.maxPapers || 5,
    });
  }
);

registerTool(
  {
    name: "generate_crawler_plugin",
    description: "Generate a crawler plugin for collecting papers",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string" },
        sources: { type: "array", items: { type: "string" } },
      },
      required: ["description"],
    },
    riskLevel: "high",
  },
  async (input) => {
    return {
      pluginGenerated: true,
      description: input.description,
      status: "requires_sandbox_testing",
      message: "Crawler plugin spec generated. Must pass sandbox tests before activation.",
    };
  }
);

registerTool(
  {
    name: "search_papers",
    description: "Search the paper library",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
    riskLevel: "low",
    permissionScope: "public",
  },
  async (input) => {
    const regex = new RegExp(input.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const papers = await Paper.find({
      $or: [{ title: regex }, { abstract: regex }, { tags: regex }],
    })
      .limit(input.limit || 10)
      .lean();
    return { papers, count: papers.length };
  }
);

registerTool(
  {
    name: "navigate_to_workspace",
    description: "Get the URL to navigate to a workspace",
    inputSchema: {
      type: "object",
      properties: {
        workspace: { type: "string", enum: ["ai", "trackers", "library", "writing", "governance", "foundry"] },
      },
      required: ["workspace"],
    },
    riskLevel: "low",
    permissionScope: "public",
  },
  async (input) => {
    return { workspace: input.workspace, action: "navigate" };
  }
);

export default { registerTool, getTool, listTools, executeTool };
