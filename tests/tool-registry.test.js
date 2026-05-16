import test from "node:test";
import assert from "node:assert/strict";
import { registerTool, getTool, listTools, executeTool } from "../server/services/toolRegistry.js";

// ---------------------------------------------------------------------------
// toolRegistry — validates tool registration, discovery, and execution
// Spec ref: BUILD_PLAN.md Phase 5 "Define action APIs", NEXT_GEN.md "Tool Plane"
// ---------------------------------------------------------------------------

// The module registers 10 tools at import time. We test those plus custom ones.

test("registerTool stores tool definition and handler", () => {
  registerTool(
    {
      name: "_test_echo",
      description: "Test echo tool",
      inputSchema: { type: "object", properties: { msg: { type: "string" } } },
      riskLevel: "low",
    },
    async (input) => ({ echoed: input.msg })
  );
  const tool = getTool("_test_echo");
  assert.ok(tool);
  assert.equal(tool.definition.name, "_test_echo");
  assert.equal(tool.definition.riskLevel, "low");
});

test("getTool returns null for unknown tool", () => {
  assert.equal(getTool("nonexistent_tool_xyz"), null);
});

test("listTools returns all registered tools (at least 10 built-in)", () => {
  const tools = listTools();
  assert.ok(tools.length >= 10, `expected >= 10 tools, got ${tools.length}`);
  const names = tools.map((t) => t.name);
  assert.ok(names.includes("create_tracker"));
  assert.ok(names.includes("upload_paper_pdf"));
  assert.ok(names.includes("summarize_paper"));
  assert.ok(names.includes("compare_papers"));
  assert.ok(names.includes("search_papers"));
  assert.ok(names.includes("navigate_to_workspace"));
  assert.ok(names.includes("generate_crawler_plugin"));
  assert.ok(names.includes("draft_paper_section"));
  assert.ok(names.includes("build_context_bundle"));
  assert.ok(names.includes("generate_research_board"));
});

test("listTools filters by permissionScope=public", () => {
  const publicTools = listTools({ permissionScope: "public" });
  const names = publicTools.map((t) => t.name);
  // search_papers and navigate_to_workspace are registered as public
  assert.ok(names.includes("search_papers"), "search_papers should be public");
  assert.ok(names.includes("navigate_to_workspace"), "navigate_to_workspace should be public");
  // Public tools should NOT include authenticated-only tools
  assert.ok(!names.includes("create_tracker"), "create_tracker should NOT be public");
});

test("listTools filters by permissionScope=authenticated returns public+authenticated", () => {
  const authTools = listTools({ permissionScope: "authenticated" });
  const names = authTools.map((t) => t.name);
  // Should include both public and authenticated tools
  assert.ok(names.includes("search_papers"), "public tools should be included");
  assert.ok(names.includes("create_tracker"), "authenticated tools should be included");
});

test("each built-in tool has required definition fields", () => {
  const tools = listTools();
  for (const tool of tools) {
    assert.ok(tool.name, `tool ${tool.name} must have name`);
    assert.ok(tool.description, `tool ${tool.name} must have description`);
    assert.ok(tool.inputSchema, `tool ${tool.name} must have inputSchema`);
    assert.ok(["low", "medium", "high"].includes(tool.riskLevel), `tool ${tool.name} riskLevel invalid: ${tool.riskLevel}`);
    assert.ok(["public", "authenticated"].includes(tool.permissionScope), `tool ${tool.name} permissionScope invalid`);
  }
});

test("executeTool runs handler and returns execution metadata", async () => {
  registerTool(
    {
      name: "_test_metadata",
      description: "Metadata test",
      riskLevel: "medium",
    },
    async (input) => ({ processed: input.data })
  );

  const result = await executeTool("_test_metadata", { data: "hello" }, { userId: "u1" });

  assert.equal(result.tool, "_test_metadata");
  assert.deepEqual(result.input, { data: "hello" });
  assert.deepEqual(result.result, { processed: "hello" });
  assert.ok(typeof result.duration === "number");
  assert.equal(result.riskLevel, "medium");
  assert.ok(result.executedAt);
});

test("executeTool throws for unknown tool", async () => {
  await assert.rejects(
    () => executeTool("nonexistent_tool", {}, {}),
    /Unknown tool: nonexistent_tool/
  );
});

test("executeTool handles tools with empty input", async () => {
  registerTool(
    { name: "_test_empty", description: "Empty input test", riskLevel: "low" },
    async () => ({ ok: true })
  );
  const result = await executeTool("_test_empty", {}, {});
  assert.deepEqual(result.result, { ok: true });
});

test("high-risk tools are correctly labeled", () => {
  const tools = listTools();
  const highRisk = tools.filter((t) => t.riskLevel === "high");
  assert.ok(highRisk.some((t) => t.name === "generate_crawler_plugin"),
    "generate_crawler_plugin should be high risk");
});

test("navigate_to_workspace returns workspace and action", async () => {
  const result = await executeTool("navigate_to_workspace", { workspace: "trackers" }, {});
  assert.deepEqual(result.result, { workspace: "trackers", action: "navigate" });
});

test("generate_crawler_plugin returns sandbox requirement message", async () => {
  const result = await executeTool("generate_crawler_plugin", { description: "arXiv ML crawler" }, {});
  assert.equal(result.result.pluginGenerated, true);
  assert.equal(result.result.status, "requires_sandbox_testing");
  assert.ok(result.result.message.includes("sandbox"));
});
