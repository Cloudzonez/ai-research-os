import test from "node:test";
import assert from "node:assert/strict";
import { getMcpServer, handleMcpRequest, listMcpServers } from "../server/services/mcpGateway.js";

// ---------------------------------------------------------------------------
// mcpGateway — validates JSON-RPC 2.0 MCP protocol handling
// Spec ref: BUILD_PLAN.md Phase 5 "MCP-Compatible Tool Layer"
// ---------------------------------------------------------------------------

test("getMcpServer returns server by name", () => {
  const server = getMcpServer("literature");
  assert.ok(server);
  assert.equal(server.name, "Literature Server");
  assert.ok(server.tools.length > 0);
});

test("getMcpServer returns null for unknown server", () => {
  assert.equal(getMcpServer("nonexistent_server"), null);
});

test("listMcpServers returns all 6 built-in servers", () => {
  const servers = listMcpServers();
  assert.equal(servers.length, 6);
  const names = servers.map((s) => s.name).sort();
  assert.deepEqual(names, [
    "data_analysis", "foundry", "governance",
    "literature", "pdf", "writing",
  ]);
});

test("listMcpServers each entry has name, description, and counts", () => {
  const servers = listMcpServers();
  for (const s of servers) {
    assert.ok(s.name);
    assert.ok(s.description);
    assert.ok(typeof s.toolCount === "number");
    assert.ok(typeof s.resourceCount === "number");
    assert.ok(typeof s.promptCount === "number");
  }
});

test("handleMcpRequest tools/list returns server tools", async () => {
  const response = await handleMcpRequest("literature", "tools/list", {}, {});
  assert.equal(response.jsonrpc, "2.0");
  const { tools } = response.result;
  assert.ok(tools.length > 0);
  const toolNames = tools.map((t) => t.name);
  assert.ok(toolNames.includes("search_papers"));
  assert.ok(toolNames.includes("compare_papers"));
});

test("handleMcpRequest tools/call executes a tool and wraps result in content format", async () => {
  // Use generate_crawler_plugin which doesn't require MongoDB
  const response = await handleMcpRequest("governance", "tools/call", {
    name: "generate_crawler_plugin",
    arguments: { description: "Test crawler" },
  }, {});

  assert.equal(response.jsonrpc, "2.0");
  assert.ok(response.result);
  assert.ok(Array.isArray(response.result.content));
  assert.equal(response.result.content[0].type, "text");
  const parsed = JSON.parse(response.result.content[0].text);
  assert.equal(parsed.pluginGenerated, true);
});

test("handleMcpRequest tools/call rejects tools not on the server", async () => {
  const response = await handleMcpRequest("pdf", "tools/call", {
    name: "create_tracker", // Not on PDF server
    arguments: {},
  }, {});

  assert.equal(response.jsonrpc, "2.0");
  assert.ok(response.error);
  assert.equal(response.error.code, -32601);
});

test("handleMcpRequest resources/list returns server resources", async () => {
  const response = await handleMcpRequest("literature", "resources/list", {}, {});
  assert.equal(response.jsonrpc, "2.0");
  assert.ok(Array.isArray(response.result.resources));
  assert.ok(response.result.resources.length > 0);
});

test("handleMcpRequest prompts/list returns server prompts", async () => {
  const response = await handleMcpRequest("writing", "prompts/list", {}, {});
  assert.equal(response.jsonrpc, "2.0");
  assert.ok(Array.isArray(response.result.prompts));
  assert.ok(response.result.prompts.length > 0);
});

test("handleMcpRequest health returns server status and cache stats", async () => {
  const response = await handleMcpRequest("literature", "health", {}, {});
  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.result.server, "literature");
  assert.equal(response.result.status, "ok");
  assert.ok(typeof response.result.tools === "number");
  assert.ok(response.result.cache);
  assert.ok(typeof response.result.cache.size === "number");
});

test("handleMcpRequest returns error for unknown server", async () => {
  const response = await handleMcpRequest("unknown_server", "tools/list", {}, {});
  assert.equal(response.jsonrpc, "2.0");
  assert.ok(response.error);
  assert.equal(response.error.code, -32601);
});

test("handleMcpRequest returns error for unknown method", async () => {
  const response = await handleMcpRequest("literature", "unknown_method", {}, {});
  assert.equal(response.jsonrpc, "2.0");
  assert.ok(response.error);
  assert.equal(response.error.code, -32601);
});

test("built-in pdf server has correct tools", () => {
  const server = getMcpServer("pdf");
  assert.deepEqual(server.tools, ["upload_paper_pdf", "summarize_paper"]);
});

test("built-in foundry server has correct resources and prompts", () => {
  const server = getMcpServer("foundry");
  assert.ok(server.resources.length >= 3);
  assert.ok(server.prompts.length >= 2);
  assert.ok(server.tools.includes("generate_crawler_plugin"));
});
