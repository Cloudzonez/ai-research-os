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
  crawler: {
    icon: "Workflow",
    view: "governance",
    steps: {
      zh: ["生成 SourcePlugin 草案", "沙箱运行测试样例", "审批后进入院系复用库"],
      en: ["Generate SourcePlugin draft", "Run sandbox test cases", "Approve for school reuse"],
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
