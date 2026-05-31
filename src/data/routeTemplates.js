const routeTemplates = {
  tracker: {
    icon: "Radar",
    view: "trackers",
    steps: {
      zh: ["扩展关键词与种子论文", "选择开放来源并建立计划任务", "生成领域看板与阅读路线"],
      en: ["Expand keywords and seed papers", "Select open sources and schedule jobs", "Render field board and reading route"],
    },
  },
  pdf: {
    icon: "FileText",
    view: "library",
    steps: {
      zh: ["上传 PDF 并抽取文本", "去重并设置共享权限", "生成摘要、贡献、方法与笔记"],
      en: ["Upload PDFs and extract text", "Deduplicate and set sharing", "Generate summary, contribution, method, and notes"],
    },
  },
  write: {
    icon: "PenLine",
    view: "writing",
    steps: {
      zh: ["检索相关论文与历史笔记", "生成 related work 矩阵", "写入可编辑章节草稿"],
      en: ["Retrieve papers and notes", "Build related-work matrix", "Write editable section draft"],
    },
  },
  dashboard: {
    icon: "BarChart3",
    view: "dashboards",
    steps: {
      zh: ["解析 JSON 数据", "AI 生成 HTML 可视化页面", "保存至仪表盘集合并展示"],
      en: ["Parse JSON data", "AI generates HTML visualization", "Save to dashboard collection and display"],
    },
  },
  general: {
    icon: "Sparkles",
    view: "ai",
    steps: {
      zh: ["识别科研任务意图", "构建权限安全上下文", "返回可执行工作流"],
      en: ["Detect research intent", "Build permission-safe context", "Return executable workflow"],
    },
  },
};

export default routeTemplates;
