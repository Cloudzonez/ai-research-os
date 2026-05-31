/**
 * writing.js — Related work draft generation prompts.
 *
 * Used by: server/routes/writing.js (POST /generate)
 *
 * Generates a ~200-char (ZH) or ~150-word (EN) related work section.
 * Replies with WRITE: prefix which the response parser routes to draft display.
 *
 * Related capability: See CAPABILITIES.md §4 "AI Actions"
 */

export function buildWritingPromptZh(topic) {
  return `请为以下研究主题生成一段约200字的related work草稿。主题：${topic || "AI赋能科研"}。请用中文，学术风格，引用研究领域。以 WRITE: 开头回复。`;
}

export function buildWritingPromptEn(topic) {
  return `Generate a ~150-word related work draft for research topic: "${topic || "AI-empowered research"}". Academic style, cite research areas. Start reply with WRITE:`;
}

export function buildWritingPrompt(topic, locale) {
  return locale === "zh" ? buildWritingPromptZh(topic) : buildWritingPromptEn(topic);
}
