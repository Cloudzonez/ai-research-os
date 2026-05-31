/**
 * dashboards.js — Dashboard HTML generation prompts.
 *
 * Used by: server/routes/dashboards.js (POST /)
 *
 * Generates a complete HTML dashboard page from JSON data.
 * Temperature 0.3, maxTokens 8000 for complex visualizations.
 *
 * Related capability: See CAPABILITIES.md §4 "AI Actions"
 */

export function buildDashboardPromptZh(jsonData, name, description) {
  return `你是一个数据可视化专家。根据以下 JSON 数据生成一个完整的、美观的 HTML 仪表盘页面。要求：
1. 使用内联 CSS（不使用外部样式表）
2. 包含合适的图表、卡片、表格等可视化元素
3. 使用现代设计风格（圆角、阴影、渐变）
4. 响应式布局
5. 只返回完整的 HTML 代码（从 <!DOCTYPE html> 开始），不要包含任何解释

JSON 数据：
${JSON.stringify(jsonData, null, 2)}

仪表盘标题：${name}
描述：${description || ""}`;
}

export function buildDashboardPromptEn(jsonData, name, description) {
  return `You are a data visualization expert. Generate a complete, beautiful HTML dashboard page from the following JSON data. Requirements:
1. Use inline CSS (no external stylesheets)
2. Include appropriate charts, cards, tables, and other visualization elements
3. Use modern design style (rounded corners, shadows, gradients)
4. Responsive layout
5. Return ONLY the complete HTML code (starting with <!DOCTYPE html>), no explanations

JSON data:
${JSON.stringify(jsonData, null, 2)}

Dashboard title: ${name}
Description: ${description || ""}`;
}

export function buildDashboardPrompt(jsonData, name, description, locale) {
  return locale === "zh"
    ? buildDashboardPromptZh(jsonData, name, description)
    : buildDashboardPromptEn(jsonData, name, description);
}
