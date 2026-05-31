import { chat, chatStream, parseResponse } from "./deepseek.js";
import Paper from "../models/Paper.js";
import Tracker from "../models/Tracker.js";
import { buildContextBundle, DEFAULT_TIER, MAX_CONTEXT_TOKENS } from "./contextEngine.js";
import { checkBudget, recordUsage } from "./tokenFlow.js";
import { createApproval } from "../middleware/approval.js";
import cache from "./cache.js";

// ─── Tier-aware system prompt builders ─────────────────────────────

function buildSystemPrompt(contextBundle) {
  const { papers, tier } = contextBundle;
  const header = `Available context papers (${papers.length} papers, tier ${tier}, ~${contextBundle.tokens} tokens):`;

  const entries = papers.map((p) => {
    let entry = `${p.title} (${p.source}, score: ${p.score})`;

    // Tier 1+: abstract
    if (tier >= 1 && p.abstract) {
      entry += `\n--- Abstract ---\n${p.abstract}`;
    }
    // Tier 2+: structured summary fields
    if (tier >= 2) {
      if (p.summary) entry += `\n--- Summary ---\n${p.summary}`;
      if (p.contributions) entry += `\n--- Contributions ---\n${p.contributions}`;
      if (p.methods) entry += `\n--- Methods ---\n${p.methods}`;
      if (p.limitations) entry += `\n--- Limitations ---\n${p.limitations}`;
    }
    // Tier 3+: evidence cards
    if (tier >= 3 && p.evidenceCards && p.evidenceCards.length > 0) {
      entry += `\n--- Evidence Cards ---\n${p.evidenceCards
        .map((ec) => `- Claim: ${ec.claim}\n  Evidence: ${ec.evidence}`)
        .join("\n")}`;
    }
    // Tier 4+: relevant text chunks
    if (tier >= 4 && p.textChunks && p.textChunks.length > 0) {
      entry += `\n--- Relevant Full Text Excerpts ---\n${p.textChunks
        .map((tc) => `[Chunk ${tc.index}] ${tc.text}`)
        .join("\n\n")}`;
    }

    return entry;
  });

  return `${header}\n\n${entries.join("\n\n")}`;
}

function buildContextSummary(contextBundle) {
  return contextBundle.papers
    .map((p) => {
      let entry = `${p.title} (${p.source}, score: ${p.score})`;
      if (p.abstract) entry += `\n--- Abstract ---\n${p.abstract}`;
      if (p.summary && contextBundle.tier >= 2) entry += `\n--- Summary ---\n${p.summary}`;
      if (p.contributions && contextBundle.tier >= 2) entry += `\n--- Contributions ---\n${p.contributions}`;
      if (p.methods && contextBundle.tier >= 2) entry += `\n--- Methods ---\n${p.methods}`;
      if (p.limitations && contextBundle.tier >= 2) entry += `\n--- Limitations ---\n${p.limitations}`;
      return entry;
    })
    .join("\n\n");
}

// ─── Escalation logic ──────────────────────────────────────────────

function shouldEscalate(responseText, currentTier, query) {
  if (currentTier >= 4) return false;

  const text = String(responseText || "");

  // Very short responses suggest insufficient context
  if (text.length < 50) return true;

  // Model explicitly indicates it needs more information
  if (/not enough (context|information|detail)/i.test(text)) return true;
  if (/insufficient|unable to determine|cannot (determine|answer|find)/i.test(text)) return true;

  // Query asks for detail that current tier cannot provide
  const normalized = query.toLowerCase();
  if (currentTier < 2 && /\b(method|contribution|limitation|approach|compare|analyze)/i.test(normalized)) return true;
  if (currentTier < 3 && /\b(evidence|claim|proof|verify|validate)/i.test(normalized)) return true;

  return false;
}

function jumpToTargetTier(query, currentTier) {
  const normalized = query.toLowerCase();
  if (/\b(evidence|claim|proof|verify|validate)/i.test(normalized)) return Math.max(currentTier + 1, 3);
  if (/\b(method|contribution|limitation|approach|compare|analyze)/i.test(normalized)) return Math.max(currentTier + 1, 2);
  return currentTier + 1;
}

export async function routeChat(userMessage, locale, options = {}) {
  const { userId, sessionId, paperId } = options;

  // Build context first so we know the real token estimate
  let contextBundle = await buildContextBundle(userMessage, {
    locale, userId, paperId,
    tier: options.tier ?? null,
  });

  // Check token budget with actual context token estimate
  if (userId) {
    const budget = await checkBudget(userId, contextBundle.tokens || 3000);
    if (!budget.allowed) {
      return {
        role: "assistant",
        kind: "general",
        text: locale === "zh"
          ? "本月 Token 配额已用尽，请联系管理员或等待下月重置。"
          : "Monthly token quota exhausted. Please contact admin or wait for next month reset.",
        createdAt: new Date().toISOString(),
        tokensUsed: 0,
        model: "none",
        contextBundle: {
          tokens: 0, artifacts: 0, allowedPercent: 0, papers: [],
          tier: contextBundle.tier, tierLabel: contextBundle.tierLabel,
        },
        sideEffects: {},
        quotaExceeded: true,
      };
    }
  }

  const cacheKey = cache.contextKey(userMessage);
  const cached = cache.get(cacheKey);

  // Call DeepSeek with tier-aware system prompt
  let result = await chat(
    [
      { role: "system", content: buildSystemPrompt(contextBundle) },
      { role: "user", content: userMessage },
    ],
    locale
  );
  let { kind, text, context } = parseResponse(result.content);

  // Escalation loop — if the response is insufficient, re-build and re-query
  let currentTier = contextBundle.tier;
  const maxTier = options.maxTier ?? 4;
  let escalatedFrom = null;

  while (currentTier < maxTier && shouldEscalate(text, currentTier, userMessage)) {
    escalatedFrom = currentTier;
    currentTier = jumpToTargetTier(userMessage, currentTier);

    // Re-build context at higher tier
    contextBundle = await buildContextBundle(userMessage, {
      locale, userId, paperId,
      tier: currentTier,
    });
    contextBundle.escalatedFrom = escalatedFrom;

    // Re-query with richer context
    result = await chat(
      [
        { role: "system", content: buildSystemPrompt(contextBundle) },
        { role: "user", content: userMessage },
      ],
      locale
    );
    const parsed = parseResponse(result.content);
    kind = parsed.kind;
    text = parsed.text;
  }

  // Record token usage
  if (userId) {
    await recordUsage(userId, result.tokensUsed, "chat");
  }

  const sideEffects = {};

  if (kind === "tracker") {
    // Use DeepSeek to generate proper tracker metadata
    let trackerData = {
      name: userMessage.slice(0, 60),
      keywords: [],
      sources: ["arXiv", "OpenAlex", "Semantic Scholar"],
      signals: locale === "zh" ? ["高相关", "新论文"] : ["High relevance", "New papers"],
    };

    try {
      const trackerResult = await chat(
        [{ role: "user", content: `Generate a research paper tracker for this topic: "${userMessage}". Return ONLY JSON: {"name":"Tracker name (max 60 chars)","keywords":["keyword1","keyword2",...],"sources":["arXiv","OpenAlex"],"signals":["signal1","signal2",...]}` }],
        locale,
        { temperature: 0.3, maxTokens: 500 }
      );
      const { text: trackerText } = parseResponse(trackerResult.content);
      const jsonMatch = trackerText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        trackerData = {
          name: parsed.name || userMessage.slice(0, 60),
          keywords: parsed.keywords || [],
          sources: parsed.sources || ["arXiv", "OpenAlex", "Semantic Scholar"],
          signals: parsed.signals || (locale === "zh" ? ["高相关", "新论文"] : ["High relevance", "New papers"]),
        };
      }
    } catch (e) {
      console.error("Tracker generation failed, using defaults:", e.message);
    }

    const tracker = await Tracker.create({
      name: trackerData.name,
      keywords: trackerData.keywords,
      cadence: "Daily",
      papers: 0,
      sources: trackerData.sources,
      signals: trackerData.signals,
      subscribers: 1,
      lastRun: new Date(),
    });

    sideEffects.tracker = {
      _id: tracker._id,
      id: tracker._id,
      name: tracker.name,
      cadence: tracker.cadence,
      papers: tracker.papers,
      sources: tracker.sources,
      signals: tracker.signals,
      keywords: tracker.keywords,
      subscribers: tracker.subscribers,
      lastRun: tracker.lastRun,
    };
  }

  if (kind === "write") {
    sideEffects.draft = text;
  }

  // Enrich context bundle with papers from DB
  const enrichedPapers = contextBundle.papers.length > 0
    ? contextBundle.papers
    : (await Paper.find().sort({ createdAt: -1 }).limit(5).lean()).map((p) => ({
        title: p.title,
        source: p.source,
        area: p.area,
        score: p.score,
        sharing: p.sharing,
        tags: p.tags || [],
        doi: p.doi || "",
        summary: p.summary || "",
        id: p._id?.toString(),
      }));

  // Cache the response if it's general or stable
  if (kind === "general" && !cached) {
    cache.set(cacheKey, { kind, text, result }, 600000); // 10 min TTL
  }

  return {
    role: "assistant",
    kind,
    text,
    createdAt: new Date().toISOString(),
    tokensUsed: result.tokensUsed,
    model: result.model,
    contextBundle: {
      tokens: contextBundle.tokens || result.tokensUsed || 0,
      artifacts: enrichedPapers.length,
      allowedPercent: 100,
      papers: enrichedPapers.slice(0, 5),
      query: userMessage,
      source: "context_engine",
      tier: contextBundle.tier,
      tierLabel: contextBundle.tierLabel,
      escalatedFrom: contextBundle.escalatedFrom,
    },
    sideEffects,
  };
}

/**
 * Streaming version of routeChat — emits step events during processing
 * and streams tokens as they arrive from the model.
 */
export async function routeChatStream(userMessage, locale, options = {}) {
  const { userId, sessionId, paperId, onStep, onToken } = options;

  // Step 1: Build context (so we have a real token estimate)
  if (onStep) onStep("context_building", {
    message: locale === "zh" ? "正在构建任务上下文..." : "Building task context...",
  });

  const contextBundle = await buildContextBundle(userMessage, {
    locale, userId, paperId,
    tier: options.tier ?? null,
  });

  // Step 2: Check budget with real token estimate
  if (userId) {
    const budget = await checkBudget(userId, contextBundle.tokens || 3000);
    if (!budget.allowed) {
      if (onStep) onStep("quota_exceeded", { message: locale === "zh" ? "配额已用尽" : "Quota exhausted" });
      return {
        kind: "general",
        text: locale === "zh" ? "本月 Token 配额已用尽。" : "Monthly token quota exhausted.",
        tokensUsed: 0,
        model: "none",
        contextBundle: {
          tokens: 0, artifacts: 0, allowedPercent: 0, papers: [],
          tier: contextBundle.tier, tierLabel: contextBundle.tierLabel,
        },
        sideEffects: {},
      };
    }
  }

  if (onStep) onStep("context_ready", {
    papers: contextBundle.papers.map((p) => ({ title: p.title, source: p.source, score: p.score })),
    tokenEstimate: contextBundle.tokens,
    tier: contextBundle.tier,
    tierLabel: contextBundle.tierLabel,
    artifactCount: contextBundle.artifacts,
  });

  // Step 3: Stream AI response
  if (onStep) onStep("ai_thinking", {
    message: locale === "zh" ? "AI 正在生成回复..." : "AI generating response...",
  });

  let fullContent = "";
  let tokensUsed = 0;
  let modelName = "deepseek-v4-pro";

  const contextSummary = buildContextSummary(contextBundle);

  try {
    const stream = chatStream(
      [
        {
          role: "system",
          content: `Available context papers (${contextBundle.papers.length} papers): ${contextSummary}`,
        },
        { role: "user", content: userMessage },
      ],
      locale,
      { model: options.model }
    );

    for await (const chunk of stream) {
      if (chunk.token && onToken) {
        onToken(chunk.token);
        fullContent += chunk.token;
      }
      if (chunk.done) {
        fullContent = chunk.fullContent || fullContent;
        break;
      }
    }
  } catch (e) {
    console.error("Stream error:", e.message);
    try {
      // Fallback to a shorter non-streaming call.
      const result = await chat([{ role: "user", content: userMessage }], locale, {
        model: options.model,
        timeoutMs: 15000,
        maxTokens: 900,
      });
      fullContent = result.content;
      tokensUsed = result.tokensUsed;
      modelName = result.model;
    } catch (fallbackErr) {
      console.error("Fallback chat error:", fallbackErr.message);
      fullContent = buildUnavailableModelResponse(locale, contextBundle);
      tokensUsed = contextBundle.tokens || 0;
      modelName = "context-fallback";
    }
    // Send fallback content in bulk.
    if (onToken) onToken(fullContent);
  }

  // Parse response
  const { kind, text, context } = parseResponse(fullContent);

  // Record token usage
  if (userId && tokensUsed > 0) {
    await recordUsage(userId, tokensUsed, "chat_stream");
  }

  // Step 4: Handle side effects
  const sideEffects = {};

  if (kind === "tracker") {
    if (onStep) onStep("tool_running", {
      tool: "create_tracker",
      message: locale === "zh" ? "正在创建追踪器..." : "Creating tracker...",
    });

    let trackerData = {
      name: userMessage.slice(0, 60),
      keywords: [],
      sources: ["arXiv", "OpenAlex", "Semantic Scholar"],
      signals: locale === "zh" ? ["高相关", "新论文"] : ["High relevance", "New papers"],
    };

    try {
      const trackerResult = await chat(
        [{ role: "user", content: `Generate a research paper tracker for: "${userMessage}". Return ONLY JSON: {"name":"Tracker name","keywords":["kw1"],"sources":["arXiv"],"signals":["s1"]}` }],
        locale,
        { temperature: 0.3, maxTokens: 500 }
      );
      const { text: trackerText } = parseResponse(trackerResult.content);
      const jsonMatch = trackerText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        trackerData = {
          name: parsed.name || userMessage.slice(0, 60),
          keywords: parsed.keywords || [],
          sources: parsed.sources || ["arXiv", "OpenAlex"],
          signals: parsed.signals || trackerData.signals,
        };
      }
    } catch {}

    const tracker = await Tracker.create({
      name: trackerData.name,
      keywords: trackerData.keywords,
      cadence: "Daily",
      papers: 0,
      sources: trackerData.sources,
      signals: trackerData.signals,
      subscribers: 1,
      lastRun: new Date(),
    });

    sideEffects.tracker = {
      _id: tracker._id,
      id: tracker._id,
      name: tracker.name,
      cadence: tracker.cadence,
      papers: tracker.papers,
      sources: tracker.sources,
      signals: tracker.signals,
      keywords: tracker.keywords,
      subscribers: tracker.subscribers,
      lastRun: tracker.lastRun,
    };

    if (onStep) onStep("tool_complete", {
      tool: "create_tracker",
      tracker: sideEffects.tracker,
    });
  }

  if (kind === "write") {
    sideEffects.draft = text;
    if (onStep) onStep("tool_complete", { tool: "generate_draft", draft: text.slice(0, 200) });
  }

  // Step 5: Return final result
  const enrichedPapers = contextBundle.papers.length > 0
    ? contextBundle.papers
    : (await Paper.find().sort({ createdAt: -1 }).limit(5).lean()).map((p) => ({
        title: p.title, source: p.source, area: p.area, score: p.score,
        sharing: p.sharing, tags: p.tags || [], doi: p.doi || "", summary: p.summary || "", id: p._id?.toString(),
      }));

  if (onStep) onStep("complete", {
    kind,
    tokensUsed: tokensUsed || contextBundle.tokens,
    papers: enrichedPapers.length,
  });

  return {
    role: "assistant",
    kind,
    text,
    createdAt: new Date().toISOString(),
    tokensUsed: tokensUsed || contextBundle.tokens,
    model: modelName,
    contextBundle: {
      tokens: contextBundle.tokens || tokensUsed || 0,
      artifacts: enrichedPapers.length,
      allowedPercent: 100,
      papers: enrichedPapers.slice(0, 5),
      query: userMessage,
      source: "context_engine",
      tier: contextBundle.tier,
      tierLabel: contextBundle.tierLabel,
    },
    sideEffects,
  };
}

function buildUnavailableModelResponse(locale, contextBundle) {
  const papers = (contextBundle.papers || []).map((paper) => paper.title).filter(Boolean);
  if (locale === "zh") {
    return `GENERAL: 模型服务暂时没有返回结果。已为你加载 ${papers.length} 篇上下文论文：${papers.join("；") || "暂无"}。你可以稍后重试，或先在论文库查看这些记录。`;
  }
  return `GENERAL: The model service did not return in time. I loaded ${papers.length} context paper(s): ${papers.join("; ") || "none"}. Please retry, or review these records in the library first.`;
}
