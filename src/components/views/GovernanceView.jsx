import React, { useState, useEffect } from "react";
import { WalletCards, Settings2, Server, FlaskConical, CheckCircle2, AlertTriangle } from "lucide-react";

export default function GovernanceView({ t, health, tokenUsage, crawlers = [] }) {
  const [mcpTools, setMcpTools] = useState([]);
  const isZh = true;
  const online = health?.status === "ok" || health?.db === "connected";

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ method: "tools/list", params: {} }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.result?.tools) setMcpTools(data.result.tools);
      })
      .catch(() => {});
  }, []);

  const percentUsed = tokenUsage
    ? Math.min(100, Math.round((tokenUsage.used / tokenUsage.quota) * 100))
    : 0;
  const quotaLimit = tokenUsage ? (tokenUsage.quota / 1000).toFixed(0) + "K" : "1M";
  const quotaUsed = tokenUsage ? (tokenUsage.used / 1000).toFixed(0) + "K" : "0";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-main">{t.governance}</h2>
        <p className="text-sm text-muted mt-0.5">TokenFlow / MCP / Sandbox / Deployment</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* TokenFlow */}
        <div className="surface p-5">
          <div className="flex items-center gap-2 mb-4 text-xs font-medium uppercase tracking-wider text-muted">
            <WalletCards className="h-3.5 w-3.5" />{t.tokenBudget}
          </div>
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-dull">{quotaUsed} {t.used}</span>
              <span className="text-muted">{quotaLimit} {isZh ? "配额" : "limit"}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>
          <div className="space-y-2 text-xs text-dull">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {isZh ? "缓存优先策略已启用" : "Cache-first strategy active"}
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {isZh ? "高风险操作需审批" : "Approval for high-cost actions"}
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {isZh ? "用户配额追踪已启用" : "Per-user quota tracking enabled"}
            </div>
          </div>
        </div>

        {/* MCP Tool Layer */}
        <div className="surface p-5">
          <div className="flex items-center gap-2 mb-4 text-xs font-medium uppercase tracking-wider text-muted">
            <Settings2 className="h-3.5 w-3.5" />{t.mcpLayer}
          </div>
          <div className="space-y-1.5">
            {mcpTools.length === 0 ? (
              <p className="text-xs text-muted">{isZh ? "加载中..." : "Loading tools..."}</p>
            ) : (
              mcpTools.map((tool) => (
                <div key={tool.name} className="flex items-center justify-between text-xs py-2 px-3 rounded-lg surface-alt">
                  <code className="text-dull">{tool.name}</code>
                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
                    {isZh ? "活跃" : "Active"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Remote Server */}
        <div className="surface p-5">
          <div className="flex items-center gap-2 mb-4 text-xs font-medium uppercase tracking-wider text-muted">
            <Server className="h-3.5 w-3.5" />{t.remoteTarget}
          </div>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/10 px-3 py-2.5 font-mono text-sm text-emerald-700 dark:text-emerald-300 mb-3">
            47.120.47.165:5173
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <div className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500 animate-pulse-soft" : "bg-red-500"}`} />
            {online
              ? `${isZh ? "服务器在线" : "Online"} · ${health?.model || "deepseek-v4-pro"} · ${health?.uptime ? Math.floor(health.uptime / 60) + "m" : ""}`
              : (isZh ? "离线" : "Offline")}
          </div>
        </div>

        {/* Sandbox */}
        <div className="surface p-5">
          <div className="flex items-center gap-2 mb-4 text-xs font-medium uppercase tracking-wider text-muted">
            <FlaskConical className="h-3.5 w-3.5" />{t.sandbox}
          </div>
          <div className="space-y-2 text-xs text-dull mb-3">
            {crawlers.length === 0 ? (
              <p className="text-muted">{isZh ? "暂无爬虫插件" : "No crawler plugins yet"}</p>
            ) : (
              crawlers.map((c) => (
                <div key={c._id} className="flex items-center justify-between">
                  <span>&middot; {c.name}</span>
                  <span className={`text-[10px] ${c.approved ? "text-emerald-600" : "text-amber-600"}`}>
                    {c.approved ? (isZh ? "已审批" : "Approved") : (isZh ? "待审批" : "Pending")}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
              <span>{isZh ? "爬虫代码必须先通过沙箱测试，才可复用。" : "Crawler code must pass sandbox tests before reuse."}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
