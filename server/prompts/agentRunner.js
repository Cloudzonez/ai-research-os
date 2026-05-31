/**
 * agentRunner.js — Agent system prompt builder.
 *
 * Used by: server/services/agentRunner.js (runAgent)
 *
 * Builds the system prompt for agent execution: agent instructions + available
 * tools list + tool calling format (JSON: {"tool":"name","input":{...}}).
 *
 * Related capability: See CAPABILITIES.md §4 "AI Actions"
 */

export function buildAgentSystemPrompt(agentSpec) {
  const toolList = agentSpec.allowedTools || [];
  const toolsAvailable = toolList.length > 0
    ? `Available tools: ${toolList.join(", ")}`
    : "No specific tools available.";

  return `${agentSpec.instructions}\n\n${toolsAvailable}\n\nWhen you need to use a tool, respond with a JSON object: {"tool":"tool_name","input":{...}}. Otherwise respond with your answer directly.`;
}
