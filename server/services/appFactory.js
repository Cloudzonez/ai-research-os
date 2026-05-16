import { chat } from "./deepseek.js";
import GeneratedApp from "../models/GeneratedApp.js";

const TEMPLATES = {
  literature_roadmap: {
    title: "Literature Roadmap",
    description: "Interactive research roadmap page with paper filtering",
    features: ["paper table", "method filters", "year timeline", "citation graph"],
  },
  data_dashboard: {
    title: "Data Dashboard",
    description: "Interactive data exploration dashboard",
    features: ["charts", "filters", "export", "summary stats"],
  },
  project_checklist: {
    title: "Project Checklist",
    description: "Grant/project material checklist page",
    features: ["checklist", "file upload", "progress tracker", "deadline alerts"],
  },
  knowledge_base: {
    title: "Knowledge Base",
    description: "Research group knowledge base page",
    features: ["search", "categories", "paper links", "member contributions"],
  },
};

export async function generateAppSpec(description, locale = "zh") {
  const templateList = Object.entries(TEMPLATES)
    .map(([k, v]) => `${k}: ${v.description}`)
    .join("\n");

  const prompt = locale === "zh"
    ? `分析以下科研小站需求，选择合适的模板并生成应用规格。可用模板：\n${templateList}\n\n需求：${description}\n\n返回JSON：{"template":"模板名","title":"应用标题","features":["功能1","功能2"],"dataSources":["数据源"]}`
    : `Analyze this research app request and select a template. Available templates:\n${templateList}\n\nRequest: ${description}\n\nReturn JSON: {"template":"template name","title":"App title","features":["feature1"],"dataSources":["source"]}`;

  const result = await chat([{ role: "user", content: prompt }], locale);
  const jsonMatch = result.content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return { template: "literature_roadmap", title: description.slice(0, 60), features: ["paper table"], dataSources: [] };
  }

  return JSON.parse(jsonMatch[0]);
}

export async function generateApp(userDescription, userId, locale = "zh") {
  // Step 1: Parse natural language → AppSpec
  const appSpec = await generateAppSpec(userDescription, locale);

  // Step 2: Select template
  const template = appSpec.template && TEMPLATES[appSpec.template]
    ? appSpec.template
    : "literature_roadmap";

  // Step 3: Generate app code (simplified - generates a React component skeleton)
  const codePrompt = locale === "zh"
    ? `为以下科研小站生成一个简单的React组件代码骨架：标题"${appSpec.title}"，功能：${appSpec.features?.join(", ")}。只返回JSX代码，包含基本布局即可。`
    : `Generate a simple React component skeleton for a research app: title "${appSpec.title}", features: ${appSpec.features?.join(", ")}. Return JSX code with basic layout only.`;

  const codeResult = await chat([{ role: "user", content: codePrompt }], "en");
  let code = codeResult.content;
  const codeMatch = code.match(/```(?:jsx|javascript|js|react)?\s*([\s\S]*?)```/);
  if (codeMatch) code = codeMatch[1].trim();

  // Step 4: Create GeneratedApp record
  const app = await GeneratedApp.create({
    title: appSpec.title,
    appSpec: {
      template,
      features: appSpec.features || [],
      dataSources: appSpec.dataSources || [],
    },
    template,
    sourceArtifacts: appSpec.dataSources || [],
    generatedCode: code,
    previewUrl: null,
    publishedUrl: null,
    owner: userId,
    sharingScope: "school",
    approvalState: "draft",
    auditLog: [{ action: "generated", user: userId, timestamp: new Date() }],
  });

  return { app, template: TEMPLATES[template], tokensUsed: codeResult.tokensUsed };
}

export default { generateAppSpec, generateApp, TEMPLATES };
