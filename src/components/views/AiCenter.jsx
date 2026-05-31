import React, { useRef, useEffect, useState } from "react";
import { ArrowUp, Bot, Layers3, Loader2, CheckCircle2, Wrench, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import MessageCard from "../MessageCard.jsx";
import ChatHistory from "../ChatHistory.jsx";
import quickPrompts from "../../data/quickPrompts.js";
import { EmptyState, Skeleton } from "../LoadingStates.jsx";
import { api } from "../../utils/api.js";

export default function AiCenter({ t, locale, input, setInput, submit: parentSubmit, messages, setActiveView, papers, isLoading, addToast, setMessages, setTrackers, setCrawlers, setDraft, activeSessionId, onNewChat, refreshSessionTitle, sessions, onSelectSession, onRenameSession, onDeleteSession, onToggleMarkSession, onToggleShareSession }) {
  const ref = useRef(null);
  const textareaRef = useRef(null);
  const [streamingMsg, setStreamingMsg] = useState(null); // { text, steps[], kind }
  const [streamLoading, setStreamLoading] = useState(false);

  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingMsg]);

  // Reset streaming state when session changes — ensures chat isolation
  useEffect(() => {
    setStreamingMsg(null);
    setStreamLoading(false);
  }, [activeSessionId]);

  // Auto-resize textarea as user types
  function autoResizeTextarea() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }
  useEffect(() => { autoResizeTextarea(); }, [input]);

  // Edit a user message and restart the conversation from that point
  function handleEditAndResubmit(messageIndex, newText) {
    // Keep only messages before the edited message (delete this message and everything after)
    setMessages((prev) => prev.slice(0, messageIndex));
    // Clear the input field
    setInput("");
    // Use a short delay to ensure state is updated, then submit the edited text directly
    setTimeout(() => {
      handleSubmitText(newText);
    }, 50);
  }

  // Wrapper for form/keyboard submit — reads from input state
  function handleSubmit(event) {
    if (event) event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    handleSubmitText(text);
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  // Guard against double-submit
  const submittingRef = useRef(false);

  // Core submit logic — can be called with explicit text (for edit+resubmit)
  async function handleSubmitText(text) {
    if (!text) return;
    if (submittingRef.current) return; // Prevent double-submit
    submittingRef.current = true;
    setStreamLoading(true);

    // Add user message immediately
    const userMsg = { role: "user", kind: "general", text, createdAt: new Date().toISOString() };
    setMessages((c) => [...c, userMsg]);

    // Initialize streaming state
    let streamText = "";
    const steps = [];
    let doneHandled = false; // Guard against duplicate done events
    setStreamingMsg({ text: "", steps, kind: "general" });

    // Helper: strip trailing JSON blobs and fix smart-quote spacing for display
    function cleanStreamText(t) {
      return t
        .replace(/\s*\{"context"\s*:\s*\{[\s\S]*?\}\s*\}\s*$/, "")
        .replace(/\s*\{"\w+"\s*:\s*[\[{][\s\S]{0,200}\}\s*$/, "")
        .trim()
        // Fix spaces around smart apostrophes: "I' ve" → "I've"
        .replace(/(\w)\s+['\u2018\u2019]\s+(\w)/g, "$1'$2")
        .replace(/(\w)\s+['\u2018\u2019](\w)/g, "$1'$2")
        .replace(/(\w)['\u2018\u2019]\s+(\w)/g, "$1'$2")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"');
    }

    try {
      // Use current session or fallback to "default" (avoid calling onNewChat which clears messages)
      const sessionId = activeSessionId || "default";
      const { stream } = api.submitMessageStream(text, locale, { sessionId });

      for await (const { event, data } of stream) {
        switch (event) {
          case "step":
            steps.push(data);
            setStreamingMsg((s) => s ? { ...s, steps: [...steps] } : null);
            break;

          case "token":
            streamText += data.token;
            setStreamingMsg((s) => s ? { ...s, text: cleanStreamText(streamText) } : null);
            break;

          case "done": {
            if (doneHandled) break; // Prevent duplicate done processing
            doneHandled = true;
            // Finalize message — prefer server-cleaned text, fallback to cleaned streamText
            const finalText = data.text || cleanStreamText(streamText);
            const finalMsg = {
              role: "assistant",
              kind: data.kind,
              text: finalText,
              createdAt: new Date().toISOString(),
              contextBundle: data.contextBundle,
              tokensUsed: data.tokensUsed,
              searchedPapers: data.sideEffects?.searchedPapers || [],
            };
            setMessages((c) => [...c, finalMsg]);
            setStreamingMsg(null);

            // Update session title if this was the first message
            if (activeSessionId && refreshSessionTitle) {
              refreshSessionTitle(activeSessionId, text);
            }

            // Handle side effects
            if (data.sideEffects?.tracker) {
              setTrackers((c) => [data.sideEffects.tracker, ...c]);
              if (addToast) addToast(t.toastTrackerCreated, "success");
            }
            if (data.sideEffects?.draft) {
              setDraft(data.sideEffects.draft);
              if (addToast) addToast(t.toastDraftGenerated, "success");
            }
            if (data.sideEffects?.crawler && setCrawlers) {
              setCrawlers((c) => [data.sideEffects.crawler, ...c]);
              if (addToast) addToast(locale === "zh" ? "标准采集器已配置" : "Standard crawler configured", "success");
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
      submittingRef.current = false;
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

  const [historyOpen, setHistoryOpen] = useState(true);

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* ── Inner Chat History Panel ── */}
      <div className={`shrink-0 transition-all duration-200 border-r border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-zinc-950/50 ${historyOpen ? "w-[220px]" : "w-0 overflow-hidden"}`}>
        {historyOpen && (
          <div className="p-2 h-full overflow-y-auto">
            <ChatHistory
              sessions={sessions || []}
              activeSessionId={activeSessionId}
              onSelectSession={onSelectSession}
              onNewChat={onNewChat}
              onRename={onRenameSession}
              onDelete={onDeleteSession}
              onToggleMark={onToggleMarkSession}
              onToggleShare={onToggleShareSession}
              locale={locale}
            />
          </div>
        )}
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toggle button */}
        <div className="flex items-center px-2 py-1 border-b border-gray-200 dark:border-white/5">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-gray-200/70 dark:hover:bg-white/5 transition-colors"
            title={historyOpen ? (isZh ? "收起历史" : "Hide history") : (isZh ? "展开历史" : "Show history")}
          >
            {historyOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
          {activeSessionId && sessions?.length > 0 && (
            <span className="ml-2 text-xs text-muted truncate">
              {sessions.find((s) => s._id === activeSessionId)?.title || ""}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto px-4 pt-6">
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 && !streamingMsg && !streamLoading ? (
            <EmptyState icon={Bot} title={t.aiCenter} hint={t.emptyChat} />
          ) : (
            <div className="pb-4">
              {messages.map((msg, i) => (
                <MessageCard key={`${msg.createdAt}-${i}`} message={msg} t={t} locale={locale} setActiveView={setActiveView} papers={papers} addToast={addToast} messageIndex={i} onEditAndResubmit={!streamLoading ? handleEditAndResubmit : undefined} />
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
                        <p className="text-sm leading-relaxed text-dull whitespace-pre-wrap">
                          {streamingMsg.text || (
                            <span className="inline-flex items-center gap-1 text-muted">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {isZh ? "思考中..." : "Thinking..."}
                            </span>
                          )}
                          {streamingMsg.text && (
                            <span className="inline-block w-1.5 h-4 bg-emerald-500 ml-0.5 animate-pulse align-text-bottom" />
                          )}
                        </p>
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
            {[["tracker", t.quickTracker], ["crawler", t.quickCrawler], ["pdf", t.quickPdf], ["write", t.quickWrite]].map(([k, lb]) => (
              <button key={k} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-xs text-muted hover:text-dull hover:bg-gray-200 dark:hover:bg-white/10 transition-colors" type="button" onClick={() => setInput(quickPrompts[k][locale])} disabled={streamLoading}>{lb}</button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              className="input resize-none min-h-[52px] max-h-[200px] overflow-hidden"
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
      </div>{/* end Main Chat Area */}
    </div>
  );
}
