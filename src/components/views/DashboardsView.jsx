import React, { useState } from "react";
import { BarChart3, Plus, Trash2, Eye, Loader2, ChevronRight, X } from "lucide-react";
import { api } from "../../utils/api.js";

export default function DashboardsView({ t, locale, dashboards, setDashboards, addToast }) {
  const [showForm, setShowForm] = useState(false);
  const [viewingHTML, setViewingHTML] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", jsonData: "" });
  const isZh = locale === "zh";

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.jsonData.trim()) return;

    setGenerating(true);
    try {
      const dashboard = await api.createDashboard(
        form.name.trim(),
        form.description.trim(),
        form.jsonData.trim(),
        locale
      );
      setDashboards((prev) => [dashboard, ...prev]);
      setForm({ name: "", description: "", jsonData: "" });
      setShowForm(false);
      if (addToast) addToast(t.dashboardCreated || (isZh ? "仪表盘已创建" : "Dashboard created"), "success");
    } catch (err) {
      if (addToast) addToast(err.message || t.toastActionFailed, "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm(isZh ? "确认删除此仪表盘？" : "Delete this dashboard?")) return;
    try {
      await api.deleteDashboard(id);
      setDashboards((prev) => prev.filter((d) => d._id !== id));
      if (addToast) addToast(isZh ? "已删除" : "Deleted", "success");
    } catch (err) {
      if (addToast) addToast(err.message || t.toastActionFailed, "error");
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-main">{t.dashboards || (isZh ? "仪表盘" : "Dashboards")}</h2>
          <p className="text-sm text-muted mt-0.5">
            {isZh ? "提供 JSON 数据，AI 生成可视化 HTML 页面" : "Provide JSON data, AI generates visualization HTML pages"}
          </p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          type="button"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4" />
          {t.newDashboard || (isZh ? "新建仪表盘" : "New Dashboard")}
        </button>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-200 dark:border-white/5 w-full max-w-lg max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/5">
                <h3 className="text-sm font-semibold text-main">
                  {t.newDashboard || (isZh ? "新建仪表盘" : "New Dashboard")}
                </h3>
                <button className="btn-ghost h-8 w-8 p-0" type="button" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-dull mb-1.5">
                    {t.dashboardName || (isZh ? "仪表盘名称" : "Dashboard name")}
                  </label>
                  <input
                    className="input w-full"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={isZh ? "例如：学院科研产出统计" : "e.g. Department Research Output Stats"}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dull mb-1.5">
                    {t.dashboardDescription || (isZh ? "描述" : "Description")}
                  </label>
                  <input
                    className="input w-full"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder={isZh ? "可选描述" : "Optional description"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dull mb-1.5">
                    {t.dashboardJsonData || (isZh ? "JSON 数据" : "JSON Data")}
                  </label>
                  <textarea
                    className="input w-full resize-none min-h-[160px] font-mono text-xs"
                    value={form.jsonData}
                    onChange={(e) => setForm((f) => ({ ...f, jsonData: e.target.value }))}
                    placeholder={'[{"label": "论文数", "value": 42}, {"label": "引用数", "value": 156}]'}
                    required
                  />
                </div>
                <button
                  className="btn-primary w-full flex items-center justify-center gap-2"
                  type="submit"
                  disabled={generating || !form.name.trim() || !form.jsonData.trim()}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.dashboardGenerating || (isZh ? "正在生成..." : "Generating...")}
                    </>
                  ) : (
                    t.dashboardGenerate || (isZh ? "生成 HTML" : "Generate HTML")
                  )}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* HTML Viewer Modal */}
      {viewingHTML && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setViewingHTML(null)} />
          <div className="fixed inset-4 z-50 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-200 dark:border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-white/5 shrink-0">
              <h3 className="text-sm font-semibold text-main truncate">{viewingHTML.name}</h3>
              <button className="btn-ghost h-8 w-8 p-0" type="button" onClick={() => setViewingHTML(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe
              className="flex-1 w-full border-0"
              srcDoc={viewingHTML.htmlContent}
              title={viewingHTML.name}
              sandbox="allow-scripts"
            />
          </div>
        </>
      )}

      {/* Dashboard List */}
      {dashboards.length === 0 && !showForm ? (
        <div className="text-center py-16">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted" />
          <p className="text-sm font-medium text-dull mb-1">
            {t.dashboardsEmpty || (isZh ? "暂无仪表盘" : "No dashboards yet")}
          </p>
          <p className="text-xs text-muted mb-4">
            {t.dashboardsEmptyHint || (isZh ? "创建新仪表盘，提供 JSON 数据，AI 将生成可视化 HTML 页面。" : "Create a new dashboard, provide JSON data, and AI will generate a visualization HTML page.")}
          </p>
          <button
            className="btn-primary flex items-center gap-2 mx-auto w-fit"
            type="button"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-4 w-4" />
            {t.newDashboard || (isZh ? "新建仪表盘" : "New Dashboard")}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((d) => (
            <div
              key={d._id}
              className="surface p-5 group hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setViewingHTML(d)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <BarChart3 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-main truncate">{d.name}</h3>
                </div>
                <button
                  className="btn-ghost h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(d._id); }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
              </div>
              {d.description && (
                <p className="text-xs text-dull mb-3 line-clamp-2">{d.description}</p>
              )}
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>{new Date(d.createdAt).toLocaleDateString(isZh ? "zh-CN" : "en-US")}</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Eye className="h-3 w-3" />
                  {t.dashboardViewHTML || (isZh ? "查看" : "View")}
                  <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
