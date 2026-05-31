import mongoose from "mongoose";
import { config } from "../server/config.js";
import School from "../server/models/School.js";
import User from "../server/models/User.js";
import Paper from "../server/models/Paper.js";
import Tracker from "../server/models/Tracker.js";
import Message from "../server/models/Message.js";
import AgentSpec from "../server/models/AgentSpec.js";
import AIAction from "../server/models/AIAction.js";
import Dashboard from "../server/models/Dashboard.js";
import EvalSuite from "../server/models/EvalSuite.js";
import ExecutableResearchObject from "../server/models/ExecutableResearchObject.js";
import GeneratedApp from "../server/models/GeneratedApp.js";
import GeneratedScript from "../server/models/GeneratedScript.js";
import SystemLog from "../server/models/SystemLog.js";
import ToolDefinition from "../server/models/ToolDefinition.js";
import bcrypt from "bcryptjs";

const SEED_PASSWORD = "password123";

const models = [
  { name: "SystemLog", model: SystemLog },
  { name: "AIAction", model: AIAction },
  { name: "Message", model: Message },
  { name: "GeneratedScript", model: GeneratedScript },
  { name: "ExecutableResearchObject", model: ExecutableResearchObject },
  { name: "GeneratedApp", model: GeneratedApp },
  { name: "Dashboard", model: Dashboard },
  { name: "Tracker", model: Tracker },
  { name: "Paper", model: Paper },
  { name: "EvalSuite", model: EvalSuite },
  { name: "ToolDefinition", model: ToolDefinition },
  { name: "AgentSpec", model: AgentSpec },
  { name: "User", model: User },
  { name: "School", model: School },
];

async function seed() {
  const shouldClear = process.argv.includes("--clear");
  if (!config.mongoUri) {
    console.error("MONGO_URI not configured");
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB`);

  if (shouldClear) {
    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const col of collections) {
      if (col.name !== "system.indexes" && col.name !== "system.views") {
        await mongoose.connection.db.dropCollection(col.name);
        console.log(`  Dropped ${col.name} collection`);
      }
    }
  }

  // ── School ──
  const [school] = await School.create([
    { name: "计算机科学与技术学院", departments: ["计算机系", "软件工程系", "人工智能系", "网络空间安全系"], active: true },
    { name: "School of Computer Science", departments: ["CS", "SE", "AI", "Security"], active: true },
  ]);
  console.log(`  Created ${2} schools`);

  // ── User ──
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  const [admin, teacher1, teacher2] = await User.create([
    { email: "admin@edu.cn", passwordHash: hash, name: "管理员", schoolId: school._id, role: "admin", language: "zh", quota: 9999999, active: true },
    { email: "zhang@edu.cn", passwordHash: hash, name: "张教授", schoolId: school._id, role: "teacher", language: "zh", active: true },
    { email: "li@edu.cn", passwordHash: hash, name: "李老师", schoolId: school._id, role: "teacher", language: "zh", active: true },
  ]);
  console.log(`  Created ${3} users`);

  // ── AgentSpec ──
  const [paperAgent, crawlerAgent, writingAgent] = await AgentSpec.create([
    {
      name: "paper-summarizer",
      purpose: "Summarize academic papers into structured TLDR/method/result",
      instructions: "Read paper text and produce a 5-field structured summary in the requested language",
      allowedTools: ["deepseek_chat"],
      riskLevel: "low",
      approvalPolicy: "auto",
      maxSteps: 3,
      maxCost: 8000,
      active: true,
      owner: admin._id,
    },
    {
      name: "crawler-planner",
      purpose: "Convert user research intent into structured search plans for paper APIs",
      instructions: "Analyze user query and produce source-specific search queries with filters",
      allowedTools: ["deepseek_chat", "arxiv_search", "openalex_search"],
      riskLevel: "medium",
      approvalPolicy: "auto",
      maxSteps: 5,
      maxCost: 12000,
      active: true,
      owner: admin._id,
    },
    {
      name: "writing-assistant",
      purpose: "Help users draft academic writing with citations",
      instructions: "Generate well-structured academic paragraphs with proper citations from the library",
      allowedTools: ["deepseek_chat", "paper_search"],
      riskLevel: "low",
      approvalPolicy: "auto",
      maxSteps: 8,
      maxCost: 20000,
      active: true,
      owner: teacher1._id,
    },
  ]);
  console.log(`  Created ${3} agent specs`);

  // ── ToolDefinition ──
  await ToolDefinition.create([
    { name: "arxiv_search", description: "Search papers on arXiv by query", inputSchema: { query: "string", maxResults: "number" }, outputSchema: { papers: "array" }, permissionScope: "authenticated", riskLevel: "low", sideEffectLevel: "read", auditPolicy: "log" },
    { name: "openalex_search", description: "Search papers on OpenAlex", inputSchema: { query: "string", maxResults: "number" }, outputSchema: { papers: "array" }, permissionScope: "authenticated", riskLevel: "low", sideEffectLevel: "read", auditPolicy: "log" },
    { name: "deepseek_chat", description: "Send a chat completion to DeepSeek", inputSchema: { messages: "array", model: "string" }, outputSchema: { content: "string" }, permissionScope: "authenticated", riskLevel: "low", sideEffectLevel: "none", auditPolicy: "log" },
    { name: "paper_search", description: "Search local paper library", inputSchema: { query: "string" }, outputSchema: { papers: "array" }, permissionScope: "authenticated", riskLevel: "low", sideEffectLevel: "read", auditPolicy: "log" },
    { name: "pdf_download", description: "Download PDF for a paper", inputSchema: { url: "string" }, outputSchema: { path: "string" }, permissionScope: "authenticated", riskLevel: "medium", sideEffectLevel: "write", auditPolicy: "approve" },
  ]);
  console.log(`  Created ${5} tool definitions`);

  // ── EvalSuite ──
  await EvalSuite.create([
    {
      taskType: "paper_summary",
      testCases: [
        { input: { title: "Test", abstract: "A novel method" }, expectedProperties: { tldr: "string", method: "string", result: "string" }, description: "Basic summary shape" },
      ],
      graders: ["schema_valid", "contains"],
      active: true,
    },
    {
      taskType: "search_plan",
      testCases: [
        { input: { intent: "LLM reasoning" }, expectedProperties: { queries: "array" }, description: "Search plan generation" },
      ],
      graders: ["schema_valid", "llm_judge"],
      active: true,
    },
  ]);
  console.log(`  Created ${2} eval suites`);

  // ── Paper ──
  const papers = await Paper.create([
    {
      title: "Attention Is All You Need",
      authors: ["Vaswani, Ashish", "Shazeer, Noam", "Parmar, Niki"],
      abstract: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
      doi: "10.48550/arXiv.1706.03762",
      source: "arxiv",
      sourceIds: { arxiv: "1706.03762" },
      year: 2017,
      area: "自然语言处理",
      score: 98,
      tags: ["Transformer", "Attention", "NLP", "Deep Learning"],
      status: "summarized",
      aiSummary: {
        tldr: "提出纯注意力机制的Transformer架构，彻底摒弃循环和卷积，在机器翻译任务上达到新SOTA。",
        motivation: "循环神经网络无法并行计算，训练效率低；卷积网络难以捕捉长距离依赖。",
        method: "设计多头自注意力（Multi-Head Attention）和前馈网络组成的编码器-解码器架构，使用位置编码注入序列顺序信息。",
        result: "在WMT 2014英德翻译任务上达到28.4 BLEU，优于所有现有模型，训练时间仅需3.5天（8 GPU）。",
        conclusion: "Transformer成为后续NLP模型（BERT、GPT）的基础架构。",
      },
      sharing: "school",
    },
    {
      title: "Deep Residual Learning for Image Recognition",
      authors: ["He, Kaiming", "Zhang, Xiangyu", "Ren, Shaoqing", "Sun, Jian"],
      abstract: "Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously.",
      doi: "10.1109/CVPR.2016.90",
      source: "openalex",
      year: 2016,
      area: "计算机视觉",
      score: 97,
      tags: ["ResNet", "Computer Vision", "Deep Learning"],
      status: "summarized",
      aiSummary: {
        tldr: "提出残差学习框架，通过恒等映射（identity shortcut connection）训练深度达152层的网络。",
        motivation: "网络深度增加导致退化问题（degradation），并非过拟合而是优化困难。",
        method: "引入残差块（Residual Block），让层学习残差映射 F(x) = H(x) - x，而非直接学习 H(x)。",
        result: "152层ResNet在ImageNet上达到3.57% top-5错误率，赢得ILSVRC 2015冠军。",
        conclusion: "残差连接成为现代深度网络的标准组件。",
      },
      sharing: "school",
    },
    {
      title: "Generative Adversarial Networks",
      authors: ["Goodfellow, Ian", "Pouget-Abadie, Jean", "Mirza, Mehdi"],
      abstract: "We propose a new framework for estimating generative models via an adversarial process, in which we simultaneously train two models: a generative model G that captures the data distribution, and a discriminative model D that estimates the probability that a sample came from the training data rather than G.",
      doi: "10.48550/arXiv.1406.2661",
      source: "arxiv",
      year: 2014,
      area: "生成模型",
      score: 96,
      tags: ["GAN", "Generative", "Adversarial"],
      status: "summarized",
      aiSummary: {
        tldr: "提出生成对抗网络（GAN），通过生成器与判别器的博弈训练生成模型。",
        motivation: "传统生成模型需要复杂的马尔可夫链或变分下界近似，难以扩展。",
        method: "生成器G从噪声生成样本，判别器D区分真假样本，两者进行极小极大博弈。",
        result: "在MNIST等数据集上生成质量超越已有方法，开创对抗训练范式。",
        conclusion: "GAN启发了大量后续工作，推动生成式AI发展。",
      },
      sharing: "school",
    },
    {
      title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
      authors: ["Devlin, Jacob", "Chang, Ming-Wei", "Lee, Kenton", "Toutanova, Kristina"],
      abstract: "We introduce BERT, a new language representation model that stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.",
      doi: "10.48550/arXiv.1810.04805",
      source: "arxiv",
      year: 2018,
      area: "自然语言处理",
      score: 99,
      tags: ["BERT", "Pre-training", "NLP", "Transformer"],
      status: "summarized",
      sharing: "university",
    },
    {
      title: "LLaMA: Open and Efficient Foundation Language Models",
      authors: ["Touvron, Hugo", "Lavril, Thibaut", "Izacard, Gautier"],
      abstract: "We introduce LLaMA, a collection of foundation language models ranging from 7B to 65B parameters. We train our models on trillions of tokens, and show that it is possible to train state-of-the-art models using publicly available datasets exclusively, without resorting to proprietary and inaccessible datasets.",
      source: "openalex",
      year: 2023,
      area: "大语言模型",
      score: 95,
      tags: ["LLaMA", "LLM", "Open Source", "Foundation Model"],
      status: "triaged",
      sharing: "school",
    },
  ]);
  console.log(`  Created ${papers.length} papers`);

  // ── Tracker ──
  const [tracker1, tracker2] = await Tracker.create([
    {
      name: "LLM 最新进展追踪",
      cadence: "Daily",
      papers: 12,
      sources: ["arXiv", "OpenAlex"],
      signals: ["新论文", "高引用"],
      subscribers: 3,
      keywords: ["large language model", "LLM", "transformer", "attention"],
      crawlStatus: "completed",
      lastCrawlQuery: "large language model 2024",
      active: true,
    },
    {
      name: "计算机视觉前沿",
      cadence: "Weekly",
      papers: 8,
      sources: ["arXiv", "Semantic Scholar"],
      signals: ["突破性进展"],
      subscribers: 2,
      keywords: ["object detection", "segmentation", "vision transformer", "diffusion"],
      crawlStatus: "idle",
      lastRun: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      active: true,
    },
  ]);
  console.log(`  Created ${2} trackers`);

  // ── Dashboard ──
  await Dashboard.create([
    {
      name: "学院论文统计看板",
      description: "展示本学院论文发表趋势和热点领域",
      jsonData: JSON.stringify({ widgets: [{ type: "paper_trend", title: "论文趋势" }, { type: "hot_topics", title: "热门领域" }] }),
      owner: admin._id,
      sharing: "school",
    },
    {
      name: "个人研究面板",
      description: "个人论文阅读进度和追踪概览",
      jsonData: JSON.stringify({ widgets: [{ type: "reading_list", title: "阅读列表" }, { type: "tracker_status", title: "追踪状态" }] }),
      owner: teacher1._id,
      sharing: "private",
    },
  ]);
  console.log(`  Created ${2} dashboards`);

  // ── Message ──
  await Message.create([
    { role: "user", kind: "general", text: "帮我找一下最新的 Transformer 相关论文", sessionId: "session-1", route: { view: "ai-center", icon: "search" } },
    { role: "assistant", kind: "general", text: "我帮你搜索了arXiv和OpenAlex，以下是近期关于Transformer的高质量论文...", sessionId: "session-1", contextBundle: { tokens: 1200, artifacts: 5, allowedPercent: 80, papers: [{ title: "Attention Is All You Need", source: "arxiv", tags: ["Transformer"] }] } },
    { role: "user", kind: "pdf", text: "帮我总结这篇论文的核心贡献", sessionId: "session-1" },
    { role: "assistant", kind: "pdf", text: "这篇论文的核心贡献是提出了纯注意力机制的Transformer架构...", sessionId: "session-1" },
  ]);
  console.log(`  Created ${4} messages`);

  // ── AIAction ──
  await AIAction.create([
    { action: "summarize_paper", model: "deepseek-v4-pro", inputText: "Attention Is All You Need abstract...", outputText: "Generated structured summary", tokensUsed: 3500, kind: "tracker", riskLevel: "low", sessionId: "session-1" },
    { action: "search_plan", model: "deepseek-v4-pro", inputText: "Find papers about reinforcement learning", outputText: "Generated search plan with 3 queries", tokensUsed: 2100, kind: "crawler", riskLevel: "medium", approvalState: "auto_approved", sessionId: "session-2" },
  ]);
  console.log(`  Created ${2} AI actions`);

  // ── GeneratedScript ──
  const [script] = await GeneratedScript.create([
    {
      title: "analyze_citation_trends",
      language: "python",
      inputSchema: { paper_ids: "array<string>" },
      outputSchema: { trend_data: "object" },
      dependencies: ["numpy", "pandas", "matplotlib"],
      code: "def analyze(paper_ids):\n    # TODO: implement citation trend analysis\n    pass",
      owner: teacher1._id,
      sharingScope: "school",
      version: "1.0.0",
    },
  ]);
  console.log(`  Created ${1} generated script`);

  // ── ExecutableResearchObject ──
  await ExecutableResearchObject.create([
    {
      title: "Transformer 可复现研究报告",
      sourceData: [{ name: "paper_list.csv", uri: "/data/transformer_papers.csv", size: 2048 }],
      scripts: [script._id],
      environment: { language: "python" },
      replayStatus: "not_run",
      owner: teacher2._id,
      sharingScope: "school",
    },
  ]);
  console.log(`  Created ${1} executable research object`);

  // ── GeneratedApp ──
  await GeneratedApp.create([
    {
      title: "文献路线图：Transformer 演进",
      appSpec: { layout: "timeline", nodes: ["Attention", "BERT", "GPT", "LLaMA"] },
      template: "literature_roadmap",
      sourceArtifacts: ["paper:Attention", "paper:BERT", "paper:GPT"],
      owner: admin._id,
      sharingScope: "school",
      approvalState: "approved",
      approvedBy: admin._id,
    },
  ]);
  console.log(`  Created ${1} generated app`);

  // ── SystemLog ──
  await SystemLog.create([
    { level: "info", namespace: "seed", event: "seed_completed", message: "Seed script executed successfully", pid: process.pid },
    { level: "info", namespace: "auth", event: "user_login", message: "User admin@edu.cn logged in", userId: admin._id.toString() },
    { level: "warn", namespace: "crawler", event: "rate_limit_hit", message: "arXiv API rate limit reached, backing off", method: "GET", path: "/api/trackers/crawl" },
  ]);
  console.log(`  Created ${3} system logs`);

  console.log("\n✅ Seed complete!");
  console.log(`   Login email: admin@edu.cn / ${SEED_PASSWORD}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
