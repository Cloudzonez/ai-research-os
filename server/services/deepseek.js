import { config } from "../config.js";

const SYSTEM_PROMPT_ZH = `你是高校 AI 科研操作系统中的 AI 助手。你的用户是中国大学教师。

你可以执行以下操作：
1. 创建论文追踪器 (create_tracker) - 帮教师追踪特定研究领域的最新论文
2. 处理 PDF (upload_paper_pdf) - 帮助上传和解析论文PDF
3. 生成写作草稿 (draft_paper_section) - 根据文献生成related work等内容
4. 构建上下文 (build_context_bundle) - 为任务检索相关论文和笔记
5. 生成爬虫插件 (generate_crawler_plugin) - 生成论文爬虫代码

回复规则：
- 如果用户想追踪某个研究领域，回复以 "TRACKER:" 开头，然后给出追踪器名称和关键词
- 如果用户想上传或处理PDF，回复以 "PDF:" 开头
- 如果用户想写related work或草稿，回复以 "WRITE:" 开头，然后提供草稿内容
- 如果用户想生成爬虫，回复以 "CRAWLER:" 开头
- 否则回复以 "GENERAL:" 开头，进行友好对话
- 在回复末尾，用 JSON 格式提供上下文信息：{"context":{"papers":["论文标题"],"tokens":1234,"artifacts":3}}
- 始终使用中文回复`;

const SYSTEM_PROMPT_EN = `You are the AI assistant in the University AI Research OS. Your users are university teachers.

You can perform these actions:
1. Create paper trackers (create_tracker) - help teachers track latest papers in research areas
2. Process PDFs (upload_paper_pdf) - help upload and parse paper PDFs
3. Generate writing drafts (draft_paper_section) - generate related work content from literature
4. Build context (build_context_bundle) - retrieve relevant papers and notes for tasks
5. Generate crawler plugins (generate_crawler_plugin) - generate paper crawler code

Reply rules:
- If user wants to track a research area, start reply with "TRACKER:" followed by tracker name and keywords
- If user wants to upload/process PDFs, start reply with "PDF:"
- If user wants to write related work or draft, start reply with "WRITE:" followed by draft content
- If user wants to generate a crawler, start reply with "CRAWLER:"
- Otherwise start reply with "GENERAL:" for friendly conversation
- At the end of reply, include context info as JSON: {"context":{"papers":["paper title"],"tokens":1234,"artifacts":3}}`;

export async function chat(messages, locale = "zh", options = {}) {
  const systemPrompt = locale === "zh" ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
  const model = options.model || config.chatModel || config.model;

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens || 2048,
    stream: false,
  };

  const res = await fetch(`${config.deepseekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.deepseekApiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs || 30000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const tokensUsed = data.usage?.total_tokens || 0;

  return { content, tokensUsed, model: data.model };
}

/**
 * Streaming chat — yields tokens as they arrive from the DeepSeek API.
 * Returns an async generator that yields { token, done, finishReason } objects.
 */
export async function* chatStream(messages, locale = "zh", options = {}) {
  const systemPrompt = locale === "zh" ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;
  const model = options.model || config.chatModel || config.model;

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens || 2048,
    stream: true,
  };

  const res = await fetch(`${config.deepseekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.deepseekApiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs || 45000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let finishReason = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const dataStr = trimmed.slice(6);

        if (dataStr === "[DONE]") {
          finishReason = "stop";
          yield { token: "", done: true, finishReason: "stop", fullContent };
          return;
        }

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta;
          const chunkFinish = parsed.choices?.[0]?.finish_reason;

          if (delta?.content) {
            fullContent += delta.content;
            yield { token: delta.content, done: false, finishReason: null, fullContent };
          }

          if (chunkFinish) {
            finishReason = chunkFinish;
            yield { token: "", done: true, finishReason: chunkFinish, fullContent };
            return;
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { token: "", done: true, finishReason: finishReason || "stop", fullContent };
}

export function parseResponse(content) {
  let kind = "general";
  let text = content;
  let context = { papers: [], tokens: 0, artifacts: 0 };

  const prefixPatterns = [
    [/^(?:TRACKER|追踪器)[:：]\s*/i, "tracker"],
    [/^(?:PDF|上传)[:：]\s*/i, "pdf"],
    [/^(?:WRITE|写作|草稿)[:：]\s*/i, "write"],
    [/^(?:CRAWLER|爬虫)[:：]\s*/i, "crawler"],
    [/^(?:GENERAL|一般)[:：]\s*/i, "general"],
  ];

  for (const [regex, k] of prefixPatterns) {
    if (regex.test(text)) {
      kind = k;
      text = text.replace(regex, "");
      break;
    }
  }

  // Also check inline markers if no prefix found at start
  if (kind === "general") {
    if (/PDF[:：]\s*/i.test(text)) kind = "pdf";
    else if (/爬虫|crawler[:：]\s*/i.test(text)) kind = "crawler";
  }

  const contextMatch = text.match(/\{"context":\{[^}]+\}\}/);
  if (contextMatch) {
    try {
      const parsed = JSON.parse(contextMatch[0]);
      context = { ...context, ...parsed.context };
      text = text.replace(contextMatch[0], "").trim();
    } catch {}
  }

  return { kind, text: text.trim(), context };
}
