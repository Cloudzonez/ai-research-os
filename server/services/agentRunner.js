import { executeTool } from "./toolRegistry.js";
import { chat } from "./deepseek.js";
import cache from "./cache.js";
import { buildAgentSystemPrompt } from "../prompts/agentRunner.js";

/**
 * Agent Runner - executes an agent spec against a user task.
 * Tracks state, tool calls, costs, and supports trace/replay.
 */
const RUN_STATES = [
  "created",
  "context_built",
  "tool_calling",
  "awaiting_approval",
  "running_sandbox",
  "completed",
  "failed",
];

export async function runAgent(agentSpec, userTask, options = {}) {
  const { locale = "zh", userId } = options;
  const trace = {
    agentSpec: agentSpec.name,
    userTask,
    startTime: new Date().toISOString(),
    state: "created",
    steps: [],
    totalTokens: 0,
    totalCost: 0,
  };

  try {
    trace.state = "context_built";

    // Step 1: Build context
    trace.steps.push({
      state: "context_built",
      timestamp: new Date().toISOString(),
      message: locale === "zh" ? "正在构建任务上下文..." : "Building task context...",
    });

    // Step 2: Determine tool calls needed
    trace.state = "tool_calling";

    const systemPrompt = buildAgentSystemPrompt(agentSpec);

    const result = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userTask },
      ],
      locale
    );

    trace.totalTokens += result.tokensUsed;
    trace.totalCost += result.tokensUsed * 0.000002; // rough cost estimate

    let response = result.content.trim();

    // Step 3: Check for tool call requests
    const toolCallMatch = response.match(/\{"tool"\s*:\s*"(\w+)",\s*"input"\s*:\s*(\{.*?\})\s*\}/);
    if (toolCallMatch && toolList.includes(toolCallMatch[1])) {
      const toolName = toolCallMatch[1];
      let toolInput;
      try {
        toolInput = JSON.parse(toolCallMatch[2]);
      } catch {
        toolInput = {};
      }

      // Check if high-risk and needs approval
      if (agentSpec.approvalPolicy !== "auto") {
        trace.state = "awaiting_approval";
        trace.steps.push({
          state: "awaiting_approval",
          timestamp: new Date().toISOString(),
          tool: toolName,
          message: locale === "zh"
            ? `工具 ${toolName} 需要审批`
            : `Tool ${toolName} requires approval`,
        });
      }

      trace.steps.push({
        state: "tool_calling",
        timestamp: new Date().toISOString(),
        tool: toolName,
        input: toolInput,
      });

      const execResult = await executeTool(toolName, toolInput, { locale, userId });
      trace.steps.push({
        state: "tool_calling",
        timestamp: new Date().toISOString(),
        result: execResult.result,
        duration: execResult.duration,
      });

      response = locale === "zh"
        ? `已执行工具 "${toolName}"，结果：${JSON.stringify(execResult.result).slice(0, 500)}`
        : `Executed tool "${toolName}", result: ${JSON.stringify(execResult.result).slice(0, 500)}`;
    }

    trace.state = "completed";
    trace.steps.push({
      state: "completed",
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      response,
      trace,
      tokensUsed: trace.totalTokens,
    };
  } catch (err) {
    trace.state = "failed";
    trace.steps.push({
      state: "failed",
      timestamp: new Date().toISOString(),
      error: err.message,
    });

    return {
      success: false,
      error: err.message,
      trace,
    };
  }
}

export default { runAgent };
