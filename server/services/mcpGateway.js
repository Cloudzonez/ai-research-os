import { listTools, executeTool } from "./toolRegistry.js";
import cache from "./cache.js";

// Domain MCP servers
const mcpServers = {};

export function registerMcpServer(name, server) {
  mcpServers[name] = server;
}

export function getMcpServer(name) {
  return mcpServers[name] || null;
}

// Built-in MCP servers that wrap tool registry tools by domain

registerMcpServer("pdf", {
  name: "PDF Server",
  tools: ["upload_paper_pdf", "summarize_paper"],
  resources: [{ uri: "pdf://uploads", name: "Uploaded PDFs" }],
  prompts: [{ name: "summarize_pdf", description: "Summarize a PDF paper" }],
});

registerMcpServer("literature", {
  name: "Literature Server",
  tools: ["search_papers", "compare_papers", "build_context_bundle"],
  resources: [
    { uri: "papers://recent", name: "Recent Papers" },
    { uri: "papers://search", name: "Paper Search" },
  ],
  prompts: [
    { name: "literature_review", description: "Generate literature review" },
    { name: "find_related", description: "Find related papers" },
  ],
});

registerMcpServer("data_analysis", {
  name: "Data Analysis Server",
  tools: ["search_papers", "compare_papers"],
  resources: [{ uri: "data://datasets", name: "Research Datasets" }],
  prompts: [
    { name: "analyze_data", description: "Analyze research data" },
    { name: "generate_charts", description: "Generate charts from data" },
  ],
});

registerMcpServer("writing", {
  name: "Writing Server",
  tools: ["draft_paper_section", "build_context_bundle"],
  resources: [{ uri: "writing://drafts", name: "Writing Drafts" }],
  prompts: [
    { name: "draft_section", description: "Draft a paper section" },
    { name: "proofread", description: "Proofread a draft" },
  ],
});

registerMcpServer("governance", {
  name: "Governance Server",
  tools: ["create_tracker", "generate_crawler_plugin"],
  resources: [
    { uri: "governance://token_usage", name: "Token Usage Stats" },
    { uri: "governance://audit_log", name: "Audit Log" },
  ],
  prompts: [{ name: "audit_review", description: "Review audit logs" }],
});

registerMcpServer("foundry", {
  name: "Foundry Server",
  tools: ["generate_crawler_plugin", "search_papers"],
  resources: [
    { uri: "foundry://apps", name: "Generated Apps" },
    { uri: "foundry://scripts", name: "Generated Scripts" },
    { uri: "foundry://crawlers", name: "Crawler Plugins" },
  ],
  prompts: [
    { name: "generate_app", description: "Generate a research app" },
    { name: "generate_script", description: "Generate a research script" },
  ],
});

export async function handleMcpRequest(serverName, method, params, context = {}) {
  const server = getMcpServer(serverName);
  if (!server) {
    return { jsonrpc: "2.0", error: { code: -32601, message: `Unknown MCP server: ${serverName}` }, id: null };
  }

  switch (method) {
    case "tools/list":
      return {
        jsonrpc: "2.0",
        result: { tools: server.tools.map((t) => ({ name: t, description: `${server.name} tool` })) },
        id: null,
      };

    case "tools/call": {
      const { name, arguments: args } = params || {};
      if (!server.tools.includes(name)) {
        return { jsonrpc: "2.0", error: { code: -32601, message: `Tool not available on this server: ${name}` }, id: null };
      }
      const result = await executeTool(name, args || {}, context);
      return {
        jsonrpc: "2.0",
        result: { content: [{ type: "text", text: JSON.stringify(result.result) }] },
        id: null,
      };
    }

    case "resources/list":
      return { jsonrpc: "2.0", result: { resources: server.resources || [] }, id: null };

    case "prompts/list":
      return { jsonrpc: "2.0", result: { prompts: server.prompts || [] }, id: null };

    case "health":
      return {
        jsonrpc: "2.0",
        result: {
          server: serverName,
          status: "ok",
          tools: server.tools.length,
          resources: (server.resources || []).length,
          prompts: (server.prompts || []).length,
          cache: cache.stats(),
        },
        id: null,
      };

    default:
      return { jsonrpc: "2.0", error: { code: -32601, message: `Unknown method: ${method}` }, id: null };
  }
}

export function listMcpServers() {
  return Object.entries(mcpServers).map(([key, server]) => ({
    name: key,
    description: server.name,
    toolCount: server.tools?.length || 0,
    resourceCount: (server.resources || []).length,
    promptCount: (server.prompts || []).length,
  }));
}

export default { registerMcpServer, getMcpServer, handleMcpRequest, listMcpServers };
