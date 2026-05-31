/**
 * foundry.js — Script code generation prompt.
 *
 * Used by: server/routes/foundry.js (POST /scripts/generate)
 *
 * Generates a self-contained runnable script (JS by default) from description.
 *
 * Related capability: See CAPABILITIES.md §4 "AI Actions"
 */

export function buildScriptGenPrompt(description, language) {
  return `Generate a ${language || "JavaScript"} script for: "${description}". Return only code, no explanations. The script should be self-contained and runnable.`;
}
