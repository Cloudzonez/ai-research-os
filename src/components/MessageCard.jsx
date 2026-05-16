import React, { useState } from "react";
import { ArrowRight, Layers3, Bot, CheckCircle2, Route, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import routeTemplates from "../data/routeTemplates.js";

function formatTokens(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function MessageCard({ message, t, locale, setActiveView, papers = [] }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-4 animate-fade-in">
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-emerald-600 text-white px-4 py-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
    );
  }

  const route = routeTemplates[message.kind] || routeTemplates.general;
  const steps = route.steps?.[locale] || [];

  // Use real context bundle data from the message
  const ctx = message.contextBundle || {};
  const ctxTokens = ctx.tokens || 0;
  const ctxArtifacts = ctx.artifacts || 0;
  const ctxAllowed = ctx.allowedPercent ?? 100;
  const ctxPapers = ctx.papers?.length ? ctx.papers : papers;
  const ctxSource = ctx.source;

  return (
    <div className="mb-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <p className="text-sm leading-relaxed text-dull whitespace-pre-wrap">{message.text}</p>

          <div className="surface p-4 space-y-3">
            <div className="flex items-center gap-2 text-[13px] font-medium text-main">
              <Route className="h-4 w-4 text-emerald-500" />{t.routeTitle}
            </div>
            <div className="space-y-1.5">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px] text-dull">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />{step}
                </div>
              ))}
            </div>
            <button className="btn-secondary h-8 text-xs" type="button" onClick={() => setActiveView(route.view || "ai")}>
              {t.openWorkspace}<ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] font-medium text-main">
                <Layers3 className="h-4 w-4 text-amber-500" />{t.contextBuilt}
              </div>
              {ctxSource && (
                <span className="text-[10px] text-muted bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                  {ctxSource}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="surface-inset p-2">
                <div className="text-sm font-semibold text-main">{formatTokens(ctxTokens)}</div>
                <div className="text-[10px] text-muted">tokens</div>
              </div>
              <div className="surface-inset p-2">
                <div className="text-sm font-semibold text-main">{ctxArtifacts}</div>
                <div className="text-[10px] text-muted">{locale === "zh" ? "素材" : "artifacts"}</div>
              </div>
              <div className="surface-inset p-2">
                <div className="text-sm font-semibold text-main">{ctxAllowed}%</div>
                <div className="text-[10px] text-muted">{locale === "zh" ? "已授权" : "allowed"}</div>
              </div>
            </div>

            {/* Source attribution */}
            {ctxPapers.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1 text-[12px] text-emerald-600 dark:text-emerald-400 hover:underline"
                  onClick={() => setSourcesOpen(!sourcesOpen)}
                >
                  <BookOpen className="h-3 w-3" />
                  {locale === "zh" ? `查看来源 (${ctxPapers.length})` : `View sources (${ctxPapers.length})`}
                  {sourcesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {sourcesOpen && (
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {ctxPapers.map((p, i) => (
                      <div key={p.id || p.title || i} className="surface-inset p-2 rounded-lg">
                        <div className="flex items-start gap-2 text-[12px]">
                          <span className="text-[10px] font-mono text-muted shrink-0 mt-0.5">[{i + 1}]</span>
                          <div>
                            <span className="text-dull font-medium line-clamp-2">{p.title}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.source && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1 rounded">{p.source}</span>}
                              {p.score > 0 && <span className="text-[10px] text-muted">{locale === "zh" ? "相关度" : "relevance"}: {p.score}</span>}
                              {p.doi && <span className="text-[10px] text-muted truncate max-w-[120px]">DOI: {p.doi}</span>}
                              {p.sharing && <span className="text-[10px] text-amber-600 dark:text-amber-400">{p.sharing}</span>}
                            </div>
                            {p.summary && <p className="text-[11px] text-muted mt-1 line-clamp-2">{p.summary}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
