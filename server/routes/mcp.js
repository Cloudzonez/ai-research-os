import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { listTools, executeTool } from "../services/toolRegistry.js";
import { getQueueStats } from "../services/queue.js";
import cache from "../services/cache.js";

const router = Router();

// List available tools (MCP tools/list)
router.post("/", authRequired, async (req, res) => {
  try {
    const { method, params } = req.body;

    switch (method) {
      case "tools/list": {
        const tools = listTools();
        res.json({
          jsonrpc: "2.0",
          result: {
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          },
          id: params?.id || null,
        });
        break;
      }

      case "tools/call": {
        const { name, arguments: args } = params || {};
        if (!name) {
          return res.json({ jsonrpc: "2.0", error: { code: -32602, message: "Missing tool name" }, id: null });
        }

        const tool = listTools().find((t) => t.name === name);
        if (!tool) {
          return res.json({ jsonrpc: "2.0", error: { code: -32601, message: `Unknown tool: ${name}` }, id: null });
        }

        // Check risk level
        if (tool.riskLevel === "high" && req.user.role !== "admin") {
          return res.json({
            jsonrpc: "2.0",
            error: { code: -32001, message: "High-risk tool requires admin approval" },
            id: null,
          });
        }

        try {
          const result = await executeTool(name, args || {}, {
            userId: req.user._id,
            locale: req.body.locale || "zh",
          });

          res.json({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: JSON.stringify(result.result, null, 2) }],
              metadata: {
                tool: name,
                duration: result.duration,
                riskLevel: result.riskLevel,
              },
            },
            id: params?.id || null,
          });
        } catch (execErr) {
          res.json({
            jsonrpc: "2.0",
            error: { code: -32000, message: execErr.message },
            id: null,
          });
        }
        break;
      }

      case "resources/list": {
        res.json({
          jsonrpc: "2.0",
          result: {
            resources: [
              { uri: "papers://recent", name: "Recent Papers", description: "Recently added research papers" },
              { uri: "papers://search", name: "Paper Search", description: "Search the paper library" },
              { uri: "trackers://active", name: "Active Trackers", description: "Currently active research trackers" },
              { uri: "context://bundle", name: "Context Bundle", description: "Task-scoped context bundle" },
            ],
          },
          id: params?.id || null,
        });
        break;
      }

      case "prompts/list": {
        res.json({
          jsonrpc: "2.0",
          result: {
            prompts: [
              {
                name: "literature_review",
                description: "Generate a literature review section from selected papers",
                arguments: [{ name: "topic", description: "Research topic", required: true }],
              },
              {
                name: "data_analysis",
                description: "Analyze research data and generate statistical results",
                arguments: [
                  { name: "dataDescription", description: "Description of the data", required: true },
                  { name: "method", description: "Statistical method to use", required: false },
                ],
              },
              {
                name: "grant_proposal",
                description: "Draft a grant proposal section with evidence chain",
                arguments: [{ name: "section", description: "Proposal section to draft", required: true }],
              },
            ],
          },
          id: params?.id || null,
        });
        break;
      }

      case "health": {
        const stats = await getQueueStats();
        res.json({
          jsonrpc: "2.0",
          result: {
            status: "ok",
            queue: stats,
            cache: cache.stats(),
          },
          id: params?.id || null,
        });
        break;
      }

      default:
        res.json({
          jsonrpc: "2.0",
          error: { code: -32601, message: `Unknown method: ${method}` },
          id: null,
        });
    }
  } catch (err) {
    console.error("MCP error:", err);
    res.json({
      jsonrpc: "2.0",
      error: { code: -32603, message: err.message },
      id: null,
    });
  }
});

export default router;
