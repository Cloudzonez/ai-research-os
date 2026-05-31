/**
 * appFactory.js — App spec and React code generation prompts.
 *
 * Used by: server/services/appFactory.js (generateAppSpec, generateApp)
 *
 * App spec: selects the best template from available templates based on user description.
 * React code: generates a React component skeleton for the selected app spec.
 *
 * Related capability: See CAPABILITIES.md §6 "Frontend Routes"
 */

export function buildAppSpecPromptZh(description, templateList) {
  return `分析以下科研小站需求，选择合适的模板并生成应用规格。可用模板：\n${templateList}\n\n需求：${description}\n\n返回JSON：{"template":"模板名","title":"应用标题","features":["功能1","功能2"],"dataSources":["数据源"]}`;
}

export function buildAppSpecPromptEn(description, templateList) {
  return `Analyze this research app request and select a template. Available templates:\n${templateList}\n\nRequest: ${description}\n\nReturn JSON: {"template":"template name","title":"App title","features":["feature1"],"dataSources":["source"]}`;
}

export function buildAppSpecPrompt(description, templateList, locale) {
  return locale === "zh"
    ? buildAppSpecPromptZh(description, templateList)
    : buildAppSpecPromptEn(description, templateList);
}

export function buildReactCodePromptZh(appSpec) {
  return `为以下科研小站生成一个简单的React组件代码骨架：标题"${appSpec.title}"，功能：${appSpec.features?.join(", ")}。只返回JSX代码，包含基本布局即可。`;
}

export function buildReactCodePromptEn(appSpec) {
  return `Generate a simple React component skeleton for a research app: title "${appSpec.title}", features: ${appSpec.features?.join(", ")}. Return JSX code with basic layout only.`;
}

export function buildReactCodePrompt(appSpec, locale) {
  return locale === "zh"
    ? buildReactCodePromptZh(appSpec)
    : buildReactCodePromptEn(appSpec);
}
