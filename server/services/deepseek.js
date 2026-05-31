import { config } from "../config.js";
import { getSystemPrompt } from "../prompts/chat.js";

export async function chat(messages, locale = "zh", options = {}) {
  const systemPrompt = getSystemPrompt(locale);
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
  const systemPrompt = getSystemPrompt(locale);
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
