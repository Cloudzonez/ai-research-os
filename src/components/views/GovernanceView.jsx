import React, { useState, useEffect, useCallback } from "react";
import { WalletCards, Settings2, Server, FlaskConical, CheckCircle2, AlertTriangle, Shield, Activity, Terminal, X, Search, RefreshCw } from "lucide-react";
import { api } from "../../utils/api.js";

export default function GovernanceView({ t, health, tokenUsage, user }) {
  const isZh = true;
  const online = health?.status === "ok" || health?.db === "connected";
  const isAdmin = user?.role === "admin";

  // ── MCP tools ──
  const [mcpTools, setMcpTools] = useState([]);

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

  // ── Approvals ──
  const [approvals, setApprovals] = useState([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [approvalsFilter, setApprovalsFilter] = useState("pending");

  const loadApprovals = useCallback(async () => {
    if (!isAdmin) return;
    setApprovalsLoading(true);
    try {
      const actions = await api.fetchApprovals(approvalsFilter);
      setApprovals(actions);
    } catch { setApprovals([]); }
    setApprovalsLoading(false);
  }, [isAdmin, approvalsFilter]);

  useEffect(() => { loadApprovals(); }, [loadApprovals]);

  const handleApprove = async (id) => {
    await api.approveAction(id);
    loadApprovals();
  };

  const handleDeny = async (id) => {
    await api.denyAction(id);
    loadApprovals();
  };

  // ── Logs ──
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilters, setLogFilters] = useState({ level: "", method: "", path: "", limit: 50 });

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const result = await api.fetchLogs(logFilters);
      setLogs(result.logs || []);
    } catch { setLogs([]); }
    setLogsLoading(false);
  }, [logFilters]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // ── Sandbox ──
  const [sandboxCode, setSandboxCode] = useState(`// Paste JavaScript code to test
console.log("Hello from sandbox!");
const result = 2 + 2;
console.log("2 + 2 =", result);`);
  const [sandboxOutput, setSandboxOutput] = useState(null);
  const [sandboxRunning, setSandboxRunning] = useState(false);

  const runSandbox = async () => {
    setSandboxRunning(true);
    setSandboxOutput(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/foundry/scripts/run-sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: sandboxCode, language: "javascript" }),
      });
      const data = await res.json();
      setSandboxOutput(data.result || { status: "error", output: "", error: "No response" });
    } catch (err) {
      setSandboxOutput({ status: "error", output: "", error: err.message });
    }
    setSandboxRunning(false);
  };

  const percentUsed = tokenUsage
    ? Math.min(100, Math.round((tokenUsage.used / tokenUsage.quota) * 100))
    : 0;
  const quotaLimit = tokenUsage ? (tokenUsage.quota / 1000).toFixed(0) + "K" : "1M";
  const quotaUsed = tokenUsage ? (tokenUsage.used / 1000).toFixed(0) + "K" : "0";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-main">{t.governance}</h2>
        <p className="text-sm text-muted mt-0.5">TokenFlow / MCP / Approvals / Logs / Sandbox / Deployment</p>
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
              <div className="h-full rounded-full transition-all duration-500 bg-emerald-500" style={{ width: `${percentUsed}%` }} />
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
                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">{isZh ? "活跃" : "Active"}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Approval Queue — admin only */}
        <div className="surface p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
              <Shield className="h-3.5 w-3.5" />{isZh ? "审批队列" : "Approval Queue"}
            </div>
            <div className="flex items-center gap-2">
              {["pending", "approved", "denied"].map((s) => (
                <button key={s} onClick={() => setApprovalsFilter(s)}
                  className={`text-xs px-2.5 py-1 rounded-full transition ${approvalsFilter === s ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium" : "text-muted hover:text-dull"}`}>
                  {s === "pending" ? (isZh ? "待审批" : "Pending") : s === "approved" ? (isZh ? "已批准" : "Approved") : (isZh ? "已拒绝" : "Denied")}
                </button>
              ))}
              <button onClick={loadApprovals} className="p-1 text-muted hover:text-dull">
                <RefreshCw className={`h-3.5 w-3.5 ${approvalsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          {!isAdmin ? (
            <p className="text-xs text-muted italic">{isZh ? "仅管理员可查看审批队列" : "Admin access required"}</p>
          ) : approvalsLoading ? (
            <p className="text-xs text-muted">{isZh ? "加载中..." : "Loading..."}</p>
          ) : approvals.length === 0 ? (
            <p className="text-xs text-muted italic">{isZh ? "无匹配记录" : "No matching records"}</p>
          ) : (
            <div className="space-y-2">
              {approvals.map((a) => (
                <div key={a._id} className="flex items-start justify-between text-xs py-2.5 px-3 rounded-lg surface-alt">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-dull font-medium">{a.action}</code>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        a.riskLevel === "high" ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
                        a.riskLevel === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" :
                        "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"
                      }`}>{a.riskLevel}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        a.approvalState === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                        a.approvalState === "denied" ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
                        "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                      }`}>{a.approvalState}</span>
                    </div>
                    <p className="text-dull truncate max-w-md">{a.inputText?.slice(0, 120) || a.action}</p>
                    <p className="text-muted mt-0.5">{a.model} · {a.tokensUsed} tokens · {new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                  {a.approvalState === "pending" && (
                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                      <button onClick={() => handleApprove(a._id)}
                        className="px-2.5 py-1 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20">
                        {isZh ? "批准" : "Approve"}
                      </button>
                      <button onClick={() => handleDeny(a._id)}
                        className="px-2.5 py-1 rounded text-[10px] font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20">
                        {isZh ? "拒绝" : "Deny"}
                      </button>
                    </div>
                  )}
                  {a.approvedBy && (
                    <span className="text-[10px] text-muted shrink-0 ml-3">
                      {isZh ? "审批人" : "By"}: {a.approvedBy?.name || a.approvedBy}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Log Viewer */}
        <div className="surface p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
              <Activity className="h-3.5 w-3.5" />{isZh ? "系统日志" : "System Logs"}
            </div>
            <button onClick={loadLogs} className="p-1 text-muted hover:text-dull">
              <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select value={logFilters.level} onChange={(e) => setLogFilters((p) => ({ ...p, level: e.target.value }))}
              className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-white/5 bg-transparent text-dull">
              <option value="">{isZh ? "所有级别" : "All levels"}</option>
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
            <input placeholder={isZh ? "方法 (GET/POST)..." : "Method..."} value={logFilters.method}
              onChange={(e) => setLogFilters((p) => ({ ...p, method: e.target.value }))}
              className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-white/5 bg-transparent text-dull w-24" />
            <input placeholder={isZh ? "路径..." : "Path..."} value={logFilters.path}
              onChange={(e) => setLogFilters((p) => ({ ...p, path: e.target.value }))}
              className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-white/5 bg-transparent text-dull w-40" />
            <span className="text-[10px] text-muted">{logs.length} {isZh ? "条记录" : "entries"}</span>
          </div>
          {logsLoading ? (
            <p className="text-xs text-muted">{isZh ? "加载中..." : "Loading..."}</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-muted italic">{isZh ? "无日志记录" : "No log entries"}</p>
          ) : (
            <div className="max-h-64 overflow-auto rounded-lg border border-gray-200 dark:border-white/5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/5">
                    <th className="text-left px-3 py-2 text-muted font-medium w-16">{isZh ? "级别" : "Level"}</th>
                    <th className="text-left px-3 py-2 text-muted font-medium">{isZh ? "消息" : "Message"}</th>
                    <th className="text-left px-3 py-2 text-muted font-medium w-20">{isZh ? "方法" : "Method"}</th>
                    <th className="text-left px-3 py-2 text-muted font-medium w-32">{isZh ? "路径" : "Path"}</th>
                    <th className="text-left px-3 py-2 text-muted font-medium w-16">{isZh ? "状态" : "Status"}</th>
                    <th className="text-left px-3 py-2 text-muted font-medium w-24">{isZh ? "时间" : "Time"}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log._id || i} className="border-t border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          log.level === "error" ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
                          log.level === "warn" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" :
                          log.level === "info" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
                          "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"
                        }`}>{log.level}</span>
                      </td>
                      <td className="px-3 py-2 text-dull truncate max-w-xs">{log.message || log.event}</td>
                      <td className="px-3 py-2 text-muted">{log.method}</td>
                      <td className="px-3 py-2 text-muted truncate max-w-32">{log.path}</td>
                      <td className="px-3 py-2 text-muted">{log.statusCode}</td>
                      <td className="px-3 py-2 text-muted whitespace-nowrap">{log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sandbox */}
        <div className="surface p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-4 text-xs font-medium uppercase tracking-wider text-muted">
            <Terminal className="h-3.5 w-3.5" />{isZh ? "沙箱执行" : "Sandbox"}
          </div>
          <textarea value={sandboxCode} onChange={(e) => setSandboxCode(e.target.value)}
            className="w-full h-28 px-3 py-2 text-xs font-mono rounded-lg border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-black/20 text-dull resize-none mb-3"
            placeholder={isZh ? "输入 JavaScript 代码..." : "Enter JavaScript code..."} />
          <div className="flex items-center gap-2 mb-3">
            <button onClick={runSandbox} disabled={sandboxRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 disabled:opacity-50">
              <Terminal className="h-3 w-3" />{sandboxRunning ? (isZh ? "执行中..." : "Running...") : (isZh ? "执行" : "Run")}
            </button>
            <span className="text-[10px] text-muted">{isZh ? "代码在隔离的 Node.js 子进程中运行" : "Runs in isolated Node.js child process"}</span>
          </div>
          {sandboxOutput && (
            <div className="rounded-lg border border-gray-200 dark:border-white/5 bg-black/5 dark:bg-white/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${
                  sandboxOutput.status === "completed" ? "text-emerald-600" : "text-red-600"
                }`}>
                  {sandboxOutput.status === "completed" ? (isZh ? "执行成功" : "Completed") : (isZh ? "执行失败" : "Failed")}
                </span>
                <button onClick={() => setSandboxOutput(null)} className="p-0.5 text-muted hover:text-dull">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <pre className="text-xs font-mono text-dull whitespace-pre-wrap max-h-40 overflow-auto">{sandboxOutput.output || sandboxOutput.error || "(no output)"}</pre>
            </div>
          )}
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

        {/* AI Governance */}
        <div className="surface p-5">
          <div className="flex items-center gap-2 mb-4 text-xs font-medium uppercase tracking-wider text-muted">
            <FlaskConical className="h-3.5 w-3.5" />{t.aiSafety}
          </div>
          <div className="space-y-2 text-xs text-dull mb-3">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {isZh ? "所有 AI 操作可审计" : "All AI actions are auditable"}
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {isZh ? "模型输出经过解析与校验" : "Model outputs are parsed and validated"}
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {isZh ? "用户配额实时追踪" : "Real-time per-user quota tracking"}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
              <span>{isZh ? "所有论文采集使用平台维护的标准连接器，不执行 AI 生成的代码。" : "All paper crawling uses platform-maintained standard connectors. No AI-generated code is executed."}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
