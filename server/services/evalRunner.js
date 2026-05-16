import { runAgent } from "./agentRunner.js";
import EvalSuite from "../models/EvalSuite.js";

export async function runEvalSuite(suiteId, agentSpec, options = {}) {
  const suite = await EvalSuite.findById(suiteId);
  if (!suite) throw new Error(`EvalSuite ${suiteId} not found`);

  const results = { passed: 0, failed: 0, total: suite.testCases.length, details: [] };

  for (const testCase of suite.testCases) {
    const result = await runAgent(agentSpec, testCase.input, options);

    let passed = false;
    for (const grader of suite.graders) {
      switch (grader) {
        case "contains":
          passed = result.response?.includes(testCase.expectedProperties?.expectedText || "");
          break;
        case "schema_valid":
          try {
            JSON.parse(result.response);
            passed = true;
          } catch {
            passed = false;
          }
          break;
        case "exact_match":
          passed = result.response?.trim() === (testCase.expectedProperties?.expectedText || "").trim();
          break;
        default:
          passed = result.success;
      }
      if (!passed) break;
    }

    if (passed) results.passed++;
    else results.failed++;

    results.details.push({
      testCase: testCase.description,
      passed,
      error: passed ? null : result.error,
      tokensUsed: result.tokensUsed,
    });
  }

  // Record in regression history
  suite.regressionHistory.push({
    runAt: new Date(),
    passed: results.passed,
    failed: results.failed,
    total: results.total,
    score: results.total > 0 ? Math.round((results.passed / results.total) * 100) : 0,
    model: options.model || "deepseek-v4-pro",
  });

  await suite.save();

  return results;
}

export default { runEvalSuite };
