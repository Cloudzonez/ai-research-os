import React, { useState, useEffect } from "react";
import { X, Layers3, Network, LockKeyhole, Server } from "lucide-react";
import { sharingLabel } from "../utils/sharingLabel.js";
import { api } from "../utils/api.js";

export default function ContextPanel({ t, papers = [], trackers = [], open, onClose, health, dashboards = [] }) {
  const [mcpTools, setMcpTools] = useState([]);

  useEffect(() => {
    if (!open) return;
    // Fetch MCP tools for context display
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        // Try MCP tools
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        return fetch("/api/mcp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ method: "tools/list", params: {} }),
        });
      })
      .then((r) => r?.json?.())
      .then((data) => {
        if (data?.result?.tools) setMcpTools(data.result.tools);
      })
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  const isZh = true; // derive from t if needed
  const online = health?.status === "ok" || health?.db === "connected";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-[340px] border-l border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-950 slide-in overflow-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5">
          <h2 className="text-sm font-semibold text-main">{t.contextPanel}</h2>
          <button className="btn-ghost h-8 w-8 p-0" type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <section>
            <div className="flex items-center gap-2 mb-3 text-xs font-medium uppercase tracking-wider text-muted">
              <Layers3 className="h-3.5 w-3.5" />{t.context}
            </div>
            <p className="text-sm text-dull leading-relaxed mb-3">{t.contextHint}</p>
            {papers.length === 0 ? (
              <p className="text-xs text-muted">{isZh ? "暂无论文" : "No papers yet"}</p>
            ) : (
              papers.slice(0, 5).map((paper) => (
                <div key={paper._id || paper.title} className="surface-alt px-3 py-2.5 mb-2">
                  <div className="text-[13px] font-medium text-main line-clamp-2">{paper.title}</div>
                  <div className="mt-1 text-[11px] text-muted">
                    {paper.source} &middot; {paper.sharing ? sharingLabel(t, paper.sharing) : ""}
                    {paper.score > 0 && ` &middot; score: ${paper.score}`}
                  </div>
                </div>
              ))
            )}
          </section>
          <div className="divider" />
          <section>
            <div className="flex items-center gap-2 mb-3 text-xs font-medium uppercase tracking-wider text-muted">
              <Network className="h-3.5 w-3.5" />{t.memoryGraph}
            </div>
            {trackers.length === 0 ? (
              <p className="text-xs text-muted">{isZh ? "暂无追踪器" : "No trackers yet"}</p>
            ) : (
              trackers.slice(0, 5).map((tr) => (
                <div key={tr._id || tr.name} className="flex items-center gap-3 py-2">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${tr.active !== false ? "bg-emerald-500" : "bg-zinc-400"}`} />
                  <div className="min-w-0">
                    <div className="text-[13px] text-main truncate">{tr.name}</div>
                    <div className="text-[11px] text-muted">{tr.papers || 0} papers &middot; {tr.cadence || "Daily"}</div>
                  </div>
                </div>
              ))
            )}
          </section>
          <div className="divider" />
          <section>
            <div className="flex items-center gap-2 mb-3 text-xs font-medium uppercase tracking-wider text-muted">
              <Server className="h-3.5 w-3.5" />{t.systemHealth}
            </div>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-dull">{health?.model || "deepseek-v4-pro"}</span>
                <span className={`flex items-center gap-1.5 ${online ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500 animate-pulse-soft" : "bg-red-500"}`} />
                  {online ? (isZh ? "在线" : "Online") : (isZh ? "离线" : "Offline")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dull">{t.tokenBudget}</span>
                <span className="text-muted">{health?.uptime ? `${Math.floor(health.uptime / 60)}m uptime` : "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dull">MCP</span>
                <span className="text-muted">{mcpTools.length > 0 ? `${mcpTools.length} tools` : "..."}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dull">{isZh ? "仪表盘" : "Dashboards"}</span>
                <span className="text-muted">{dashboards.length} {isZh ? "个" : ""}</span>
              </div>
            </div>
          </section>
          <div className="divider" />
          <section>
            <div className="flex items-center gap-2 mb-3 text-xs font-medium uppercase tracking-wider text-muted">
              <LockKeyhole className="h-3.5 w-3.5" />{t.audit}
            </div>
            <div className="text-[13px] text-dull space-y-1.5">
              <p>{isZh ? "隐私：任务范围上下文" : "Privacy: task-scoped context"}</p>
              <p>{isZh ? "默认共享：院系级别" : "Sharing default: school-level"}</p>
              <p>{isZh ? "高风险操作需审批" : "Approval required for high-cost ops"}</p>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
