import React, { useState, useEffect } from "react";
import { Hammer, AppWindow, Code2, Bot, Wrench, Play, ExternalLink, FileText } from "lucide-react";
import { EmptyState, Skeleton } from "../LoadingStates.jsx";

function Tabs({ tabs, active, setActive }) {
  return (
    <div className="flex gap-0.5 p-0.5 bg-gray-100 dark:bg-white/5 rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            active === tab.key ? "bg-white dark:bg-zinc-800 text-main shadow-sm" : "text-muted hover:text-dull"
          }`}
          onClick={() => setActive(tab.key)}
        >
          {tab.icon}
          <span className="ml-1.5">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

const COLOR_MAP = {
  "bg-blue-100 dark:bg-blue-500/20": { bg: "bg-blue-100 dark:bg-blue-500/20", icon: "text-blue-600 dark:text-blue-400" },
  "bg-purple-100 dark:bg-purple-500/20": { bg: "bg-purple-100 dark:bg-purple-500/20", icon: "text-purple-600 dark:text-purple-400" },
  "bg-amber-100 dark:bg-amber-500/20": { bg: "bg-amber-100 dark:bg-amber-500/20", icon: "text-amber-600 dark:text-amber-400" },
  "bg-emerald-100 dark:bg-emerald-500/20": { bg: "bg-emerald-100 dark:bg-emerald-500/20", icon: "text-emerald-600 dark:text-emerald-400" },
};

function StatCard({ icon: Icon, label, value, color }) {
  const c = COLOR_MAP[color] || COLOR_MAP["bg-emerald-100 dark:bg-emerald-500/20"];
  return (
    <div className="surface p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${c.bg}`}>
        <Icon className={`h-5 w-5 ${c.icon}`} />
      </div>
      <div>
        <div className="text-lg font-semibold text-main">{value}</div>
        <div className="text-[11px] text-muted">{label}</div>
      </div>
    </div>
  );
}

export default function FoundryView({ t, locale = "zh" }) {
  const [tab, setTab] = useState("apps");
  const [apps, setApps] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const base = "/api/foundry";
        const token = localStorage.getItem("auth_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [appsRes, scriptsRes, agentsRes, toolsRes] = await Promise.all([
          fetch(`${base}/apps`, { headers }).then((r) => r.json()).catch(() => ({ apps: [] })),
          fetch(`${base}/scripts`, { headers }).then((r) => r.json()).catch(() => ({ scripts: [] })),
          fetch(`${base}/agents`, { headers }).then((r) => r.json()).catch(() => ({ agents: [] })),
          fetch(`${base}/tools`, { headers }).then((r) => r.json()).catch(() => ({ tools: [] })),
        ]);
        setApps(appsRes.apps || []);
        setScripts(scriptsRes.scripts || []);
        setAgents(agentsRes.agents || []);
        setTools(toolsRes.tools || []);
      } catch {
        // Backend might not be running
      }
      setLoading(false);
    })();
  }, []);

  const tabs = [
    { key: "apps", icon: <AppWindow className="h-3.5 w-3.5" />, label: t.foundryApps || (isZh ? "生成应用" : "Apps") },
    { key: "scripts", icon: <Code2 className="h-3.5 w-3.5" />, label: t.foundryScripts || (isZh ? "脚本" : "Scripts") },
    { key: "agents", icon: <Bot className="h-3.5 w-3.5" />, label: t.foundryAgents || (isZh ? "智能体" : "Agents") },
    { key: "tools", icon: <Wrench className="h-3.5 w-3.5" />, label: t.foundryTools || (isZh ? "工具" : "Tools") },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton lines={10} />
      </div>
    );
  }

  const isZh = locale === "zh";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-main">{isZh ? "科研能力生成工厂" : "Research Capability Foundry"}</h1>
        <p className="text-xs text-muted mt-1">
          {isZh ? "管理所有 AI 生成的研究工具、脚本、爬虫、智能体和工具定义" : "Manage all AI-generated research tools, scripts, crawlers, agents, and tool definitions"}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={AppWindow} label={isZh ? "生成应用" : "Apps"} value={apps.length} color="bg-blue-100 dark:bg-blue-500/20" />
        <StatCard icon={Code2} label={isZh ? "脚本" : "Scripts"} value={scripts.length} color="bg-purple-100 dark:bg-purple-500/20" />
        <StatCard icon={Bot} label={isZh ? "智能体" : "Agents"} value={agents.length} color="bg-emerald-100 dark:bg-emerald-500/20" />
        <StatCard icon={Wrench} label={isZh ? "工具" : "Tools"} value={tools.length} color="bg-amber-100 dark:bg-amber-500/20" />
      </div>

      <Tabs tabs={tabs} active={tab} setActive={setTab} />

      <div className="space-y-3">
        {tab === "apps" && (
          apps.length === 0 ? (
            <EmptyState icon={AppWindow} title={isZh ? "暂无生成应用" : "No generated apps"} hint={isZh ? "在 AI 中心描述你的研究小站需求，AI 将为你生成" : "Describe your research app needs in AI Center"} />
          ) : (
            apps.map((app) => (
              <div key={app._id} className="surface p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-main">{app.title}</span>
                    <span className="badge">{app.template || "custom"}</span>
                    <span className={`badge ${app.approvalState === "approved" ? "bg-emerald-100 text-emerald-700" : app.approvalState === "pending" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                      {app.approvalState || "draft"}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">{app.sharingScope} &middot; {new Date(app.createdAt).toLocaleDateString()}</p>
                </div>
                {app.publishedUrl && (
                  <a href={app.publishedUrl} className="btn-secondary h-7 text-xs" target="_blank" rel="noopener">
                    <ExternalLink className="h-3 w-3" /> {isZh ? "打开" : "Open"}
                  </a>
                )}
              </div>
            ))
          )
        )}

        {tab === "scripts" && (
          scripts.length === 0 ? (
            <EmptyState icon={Code2} title={isZh ? "暂无脚本" : "No scripts"} hint={isZh ? "在 AI 中心描述你的数据处理需求，AI 将生成脚本" : "Describe your data processing needs in AI Center"} />
          ) : (
            scripts.map((script) => (
              <div key={script._id} className="surface p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-main">{script.title}</span>
                    <span className="badge">{script.language}</span>
                    <span className="badge">v{script.version}</span>
                  </div>
                  {script.sandboxResult && (
                    <p className="text-xs text-muted mt-1">
                      {isZh ? "沙箱状态" : "Sandbox"}: <span className={script.sandboxResult.status === "passed" ? "text-emerald-600" : "text-red-500"}>{script.sandboxResult.status}</span>
                    </p>
                  )}
                </div>
                <button className="btn-secondary h-7 text-xs">
                  <Play className="h-3 w-3" /> {isZh ? "运行" : "Run"}
                </button>
              </div>
            ))
          )
        )}

        {tab === "agents" && (
          agents.length === 0 ? (
            <EmptyState icon={Bot} title={isZh ? "暂无智能体定义" : "No agent specs"} hint={isZh ? "管理员可定义智能体规格，控制工具权限和成本上限" : "Admins can define agent specs with tool permissions and cost limits"} />
          ) : (
            agents.map((agent) => (
              <div key={agent._id} className="surface p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-main">{agent.name}</span>
                  <span className={`badge ${agent.riskLevel === "high" ? "bg-red-100 text-red-700" : agent.riskLevel === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {agent.riskLevel}
                  </span>
                  <span className="badge">{agent.approvalPolicy}</span>
                </div>
                <p className="text-xs text-muted mt-1">{agent.purpose} &middot; {isZh ? "工具" : "Tools"}: {agent.allowedTools?.length || 0} &middot; {isZh ? "最大成本" : "Max cost"}: {agent.maxCost?.toLocaleString() || "N/A"}</p>
              </div>
            ))
          )
        )}

        {tab === "tools" && (
          tools.length === 0 ? (
            <EmptyState icon={Wrench} title={isZh ? "暂无工具定义" : "No tool definitions"} hint={isZh ? "管理员可定义平台工具，包含 schema、权限和审计策略" : "Admins can define platform tools with schemas, permissions, and audit policies"} />
          ) : (
            tools.map((tool) => (
              <div key={tool._id} className="surface p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-main">{tool.name}</span>
                  <span className={`badge ${tool.riskLevel === "high" ? "bg-red-100 text-red-700" : tool.riskLevel === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {tool.riskLevel}
                  </span>
                  <span className="badge">{tool.permissionScope}</span>
                  <span className="badge">{tool.sideEffectLevel}</span>
                  <span className="badge">v{tool.version}</span>
                </div>
                <p className="text-xs text-muted mt-1">{tool.description}</p>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
