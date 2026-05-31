import React, { useRef, useEffect, useState } from "react";
import { ArrowUp, Bot, Loader2, CheckCircle2, Layers3, Wrench } from "lucide-react";
import { api } from "../utils/api.js";
import Markdown from "./Markdown.jsx";

export default function PaperChat({ t, locale, paperId, addToast, presetMessage, onConsumed }) {
  const ref = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streamingMsg, setStreamingMsg] = useState(null);
  const [streamLoading, setStreamLoading] = useState(false);

  useEffect(() => { ref.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingMsg]);

  // Consume preset message from parent (text selection actions)
  useEffect(() => {
    if (presetMessage) {
      onConsumed?.();
      doSubmit(presetMessage);
    }
  }, [presetMessage]);

  const isZh = locale === "zh";

  function handleSubmit(e) {
    e?.preventDefault();
    doSubmit(input.trim());
  }

  async function doSubmit(text) {
    if (!text) return;
    setInput("");
    setStreamLoading(true);

    setMessages((c) => [...c, { role: "user", kind: "general", text, createdAt: new Date().toISOString() }]);

    let streamText = "";
    const steps = [];
    setStreamingMsg({ text: "", steps, kind: "general" });

    try {
      const { stream } = api.submitMessageStream(text, locale, paperId);

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
          case "done":
            setMessages((c) => [...c, {
              role: "assistant",
              kind: data.kind,
              text: streamText,
              createdAt: new Date().toISOString(),
              contextBundle: data.contextBundle,
              tokensUsed: data.tokensUsed,
            }]);
            setStreamingMsg(null);
            break;
          case "error":
            setStreamingMsg(null);
            if (addToast) addToast(data.error || t.toastActionFailed, "error");
            setMessages((c) => [...c, {
              role: "assistant", kind: "general",
              text: `${isZh ? "错误" : "Error"}: ${data.error}`,
              createdAt: new Date().toISOString(), contextBundle: null,
            }]);
            break;
        }
      }
    } catch (e) {
      console.error("Paper chat stream error:", e);
      setStreamingMsg(null);
      if (addToast) addToast(t.toastActionFailed, "error");
      setMessages((c) => [...c, {
        role: "assistant", kind: "general",
        text: `${isZh ? "流式传输失败" : "Stream failed"}: ${e.message}`,
        createdAt: new Date().toISOString(), contextBundle: null,
      }]);
    } finally {
      setStreamLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  }

  function stepLabel(step) {
    switch (step.step) {
      case "context_building": return { icon: Layers3, color: "text-amber-500", label: isZh ? "加载论文..." : "Loading paper..." };
      case "context_ready": return { icon: CheckCircle2, color: "text-emerald-500", label: isZh ? "论文已就绪" : "Paper ready" };
      case "ai_thinking": return { icon: Bot, color: "text-blue-500", label: step.message || (isZh ? "AI 分析中..." : "AI analyzing...") };
      case "tool_running": return { icon: Wrench, color: "text-purple-500", label: step.message || (isZh ? "执行工具..." : "Running tool...") };
      case "tool_complete": return { icon: CheckCircle2, color: "text-emerald-500", label: isZh ? "完成" : "Done" };
      case "complete": return { icon: CheckCircle2, color: "text-emerald-500", label: isZh ? "完成" : "Complete" };
      default: return { icon: Loader2, color: "text-muted", label: step.step };
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-3 pt-3">
        {messages.length === 0 && !streamingMsg ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot className="h-8 w-8 text-muted mb-3" />
            <p className="text-sm text-dull font-medium">{isZh ? "询问这篇论文" : "Ask about this paper"}</p>
            <p className="text-xs text-muted mt-1">{isZh ? "选中 PDF 文字后点击浮动按钮即可快速提问" : "Select text in the PDF and click the floating button to ask"}</p>
          </div>
        ) : (
          <div className="space-y-3 pb-3">
            {messages.map((msg, i) => (
              <div key={`${msg.createdAt}-${i}`} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="h-6 w-6 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                )}
                <div className={`text-sm leading-relaxed max-w-[85%] px-3 py-2 rounded-xl ${msg.role === "user" ? "bg-emerald-500 text-white rounded-br-md" : "surface"}`}>
                  {msg.role === "user" ? (
                    <p className="text-white whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <div className="markdown-chat">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {streamingMsg && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  {streamingMsg.steps.length > 0 && (
                    <div className="surface p-2 space-y-1">
                      {streamingMsg.steps.map((step, i) => {
                        const sl = stepLabel(step);
                        const Icon = sl.icon;
                        return (
                          <div key={i} className="flex items-center gap-1.5 text-[11px]">
                            <Icon className={`h-3 w-3 ${sl.color} ${step.step === "ai_thinking" ? "animate-spin" : ""}`} />
                            <span className="text-muted">{sl.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="surface p-3">
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
            )}
            <div ref={ref} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 dark:border-white/5 px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            className="paper-chat-input input resize-none min-h-[40px] max-h-[80px] text-sm"
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={isZh ? "询问关于这篇论文的问题..." : "Ask a question about this paper..."}
            disabled={streamLoading} rows={1}
          />
          <button
            className="paper-chat-submit btn-primary h-[40px] w-[40px] p-0 shrink-0 !rounded-lg"
            type="button"
            onClick={handleSubmit}
            disabled={streamLoading || !input.trim()}
            aria-label={isZh ? "发送" : "Send"}
          >
            {streamLoading ? <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
