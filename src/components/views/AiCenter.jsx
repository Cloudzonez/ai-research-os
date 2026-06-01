import React, { useRef, useEffect, useState } from "react";
import { ArrowUp, Bot, Layers3, Loader2, CheckCircle2, Wrench } from "lucide-react";
import MessageCard from "../MessageCard.jsx";
import quickPrompts from "../../data/quickPrompts.js";
import { EmptyState, Skeleton } from "../LoadingStates.jsx";
import { api } from "../../utils/api.js";
import Markdown from "../Markdown.jsx";

export default function AiCenter({ t, locale, input, setInput, submit: parentSubmit, messages, setActiveView, papers, isLoading, addToast, setMessages, setTrackers, setDraft }) {
  const ref = useRef(null);
  const [streamingMsg, setStreamingMsg] = useState(null); // { text, steps[], kind }
  const [streamLoading, setStreamLoading] = useState(false);

  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingMsg]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  async function handleSubmit(event) {
    if (event) event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    setStreamLoading(true);

    // Add user message immediately
    const userMsg = { role: "user", kind: "general", text, createdAt: new Date().toISOString() };
    setMessages((c) => [...c, userMsg]);

    // Initialize streaming state
    let streamText = "";
    const steps = [];
    setStreamingMsg({ text: "", steps, kind: "general" });

    try {
      const { stream } = api.submitMessageStream(text, locale);

      for await (const { event, data } of stream) {
        switch (event) {
          case "step":
            steps.push(data);
            setStreamingMsg((s) => s ? { ...s, steps: [...steps] } : null);
            break;

          case "token":
            streamText += data.token;
            setStreamingMsg((s) => s ? { ...s, text: streamText } : null);
            break;

          case "done": {
            // Finalize message
            const finalMsg = {
              role: "assistant",
              kind: data.kind,
              text: streamText,
              createdAt: new Date().toISOString(),
              contextBundle: data.contextBundle,
              tokensUsed: data.tokensUsed,
            };
            setMessages((c) => [...c, finalMsg]);
            setStreamingMsg(null);

            // Handle side effects
            if (data.sideEffects?.tracker) {
              setTrackers((c) => [data.sideEffects.tracker, ...c]);
              if (addToast) addToast(t.toastTrackerCreated, "success");
            }
            if (data.sideEffects?.draft) {
              setDraft(data.sideEffects.draft);
              if (addToast) addToast(t.toastDraftGenerated, "success");
            }
            if (data.sideEffects?.searchedPapers?.papers) {
              const found = data.sideEffects.searchedPapers;
              if (addToast) addToast(
                locale === "zh" ? `找到 ${found.papers.length} 篇相关论文` : `Found ${found.papers.length} related papers`,
                "success"
              );
            }
            break;
          }

          case "error":
            setStreamingMsg(null);
            if (addToast) addToast(data.error || t.toastActionFailed, "error");
            // Remove the user message on error too? No, keep it with error state
            setMessages((c) => [...c, {
              role: "assistant",
              kind: "general",
              text: `${locale === "zh" ? "错误" : "Error"}: ${data.error}`,
              createdAt: new Date().toISOString(),
              contextBundle: null,
            }]);
            break;
        }
      }
    } catch (e) {
      console.error("Stream error:", e);
      setStreamingMsg(null);
      if (addToast) addToast(t.toastActionFailed, "error");
      setMessages((c) => [...c, {
        role: "assistant",
        kind: "general",
        text: `${locale === "zh" ? "流式传输失败" : "Stream failed"}: ${e.message}`,
        createdAt: new Date().toISOString(),
        contextBundle: null,
      }]);
    } finally {
      setStreamLoading(false);
    }
  }

  const isZh = locale === "zh";

  // Map step names to icons and colors
  function stepLabel(step) {
    switch (step.step) {
      case "context_building": return { icon: Layers3, color: "text-amber-500", label: isZh ? "构建上下文..." : "Building context..." };
      case "context_ready": return { icon: CheckCircle2, color: "text-emerald-500", label: isZh ? `已加载 ${step.artifactCount || step.papers?.length || 0} 篇论文` : `Loaded ${step.artifactCount || step.papers?.length || 0} papers` };
      case "ai_thinking": return { icon: Bot, color: "text-blue-500", label: step.message || (isZh ? "AI 生成中..." : "AI generating...") };
      case "tool_running": return { icon: Wrench, color: "text-purple-500", label: step.message || (isZh ? "执行工具..." : "Running tool...") };
      case "tool_complete": return { icon: CheckCircle2, color: "text-emerald-500", label: isZh ? `工具完成: ${step.tool}` : `Tool done: ${step.tool}` };
      case "complete": return { icon: CheckCircle2, color: "text-emerald-500", label: isZh ? "完成" : "Complete" };
      default: return { icon: Loader2, color: "text-muted", label: step.step };
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="flex-1 overflow-auto px-4 pt-6">
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 && !streamingMsg && !streamLoading ? (
            <EmptyState icon={Bot} title={t.aiCenter} hint={t.emptyChat} />
          ) : (
            <div className="pb-4">
              {messages.map((msg, i) => (
                <MessageCard key={`${msg.createdAt}-${i}`} message={msg} t={t} locale={locale} setActiveView={setActiveView} papers={papers} />
              ))}

              {/* Streaming message */}
              {streamingMsg && (
                <div className="mb-4 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Background steps */}
                      {streamingMsg.steps.length > 0 && (
                        <div className="surface p-3 space-y-1.5">
                          <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-1">
                            {isZh ? "后台运行" : "Background"}
                          </div>
                          {streamingMsg.steps.map((step, i) => {
                            const sl = stepLabel(step);
                            const Icon = sl.icon;
                            return (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <Icon className={`h-3 w-3 ${sl.color} ${step.step === "ai_thinking" ? "animate-spin" : ""}`} />
                                <span className="text-dull">{sl.label}</span>
                                {step.papers && (
                                  <span className="text-[10px] text-muted">
                                    {step.papers.map((p) => p.title).join(", ").slice(0, 60)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Streaming text */}
                      <div className="surface p-4">
                        <Markdown>
                          {streamingMsg.text || ""}
                        </Markdown>
                        {!streamingMsg.text && (
                          <span className="inline-flex items-center gap-1 text-muted text-sm">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {isZh ? "思考中..." : "Thinking..."}
                          </span>
                        )}
                        {streamingMsg.text && (
                          <span className="inline-block w-1.5 h-4 bg-emerald-500 ml-0.5 animate-pulse align-text-bottom" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading spinner (fallback for non-streaming) */}
              {streamLoading && !streamingMsg && (
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-soft" />
                  </div>
                  <div className="surface flex-1 p-4"><Skeleton lines={3} /></div>
                </div>
              )}
              <div ref={ref} />
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-200 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {[["tracker", t.quickTracker], ["pdf", t.quickPdf], ["write", t.quickWrite]].map(([k, lb]) => (
              <button key={k} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-xs text-muted hover:text-dull hover:bg-gray-200 dark:hover:bg-white/10 transition-colors" type="button" onClick={() => setInput(quickPrompts[k][locale])} disabled={streamLoading}>{lb}</button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              className="input resize-none min-h-[52px] max-h-[120px]"
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={t.commandPlaceholder} disabled={streamLoading} rows={1}
            />
            <button
              className="btn-primary h-[52px] w-[52px] p-0 shrink-0 !rounded-xl"
              type="button"
              onClick={handleSubmit}
              disabled={streamLoading || !input.trim()}
              aria-label={isZh ? "提交研究需求" : "Submit research request"}
            >
              {streamLoading ? <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <ArrowUp className="h-5 w-5" />}
            </button>
          </div>
          <p className="text-[11px] text-muted text-center mt-2">
            {locale === "zh" ? "AI 可能会出错，请核对重要信息" : "AI may produce inaccurate information."}
          </p>
        </div>
      </div>
    </div>
  );
}
