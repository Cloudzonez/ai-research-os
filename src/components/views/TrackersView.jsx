import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Sparkles, Clock, Trash2, Radar, Loader2, X, RefreshCw, Activity, AlertCircle, Bot, BookOpen, ExternalLink, Eye, FileText, Github, Search, ChevronLeft, ChevronRight, Edit3, Save, Check } from "lucide-react";
import { CardSkeleton, EmptyState, ErrorDisplay } from "../LoadingStates.jsx";
import quickPrompts from "../../data/quickPrompts.js";
import { api } from "../../utils/api.js";

export default function TrackersView({ t, user, trackers: initialTrackers, setTrackers, setInput, setActiveView, locale, isLoading, error, addToast, refreshTrackers }) {
  const [trackers, setLocalTrackers] = useState(initialTrackers);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createTopic, setCreateTopic] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [crawling, setCrawling] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedTrackerId, setSelectedTrackerId] = useState(null);
  const [trackerDetail, setTrackerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [activePdf, setActivePdf] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showLowRelevance, setShowLowRelevance] = useState(false);
  const searchTimer = useRef(null);
  const isZh = locale === "zh";

  useEffect(() => { setLocalTrackers(initialTrackers); }, [initialTrackers]);

  const fetchTrackers = useCallback(async (p, query) => {
    setLoading(true);
    try {
      const res = await api.fetchTrackers({ page: p || page, q: query ?? q, limit: 20 });
      setLocalTrackers(res.trackers);
      setPagination(res.pagination);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, q]);

  useEffect(() => { fetchTrackers(1, ""); }, []);

  const handleSearch = (val) => {
    setQ(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchTrackers(1, val);
    }, 400);
  };

  const goToPage = (p) => { setPage(p); fetchTrackers(p, q); };

  async function handleQuickCreate(e) {
    e.preventDefault();
    const topic = createTopic.trim();
    if (!topic) return;
    setCreating(true);
    setCreateError("");
    try {
      const data = await api.generateTracker(topic, locale);
      setLocalTrackers((prev) => [data.tracker, ...prev]);
      setTrackers((prev) => [data.tracker, ...prev]);
      setCreateTopic("");
      setShowCreate(false);
      if (addToast) addToast(t.trackerCreated, "success");
      fetchTrackers(1, q);
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(trackerId) {
    if (!trackerId) return;
    if (!confirm(t.confirmDeleteTracker)) return;
    setDeleting(trackerId);
    try {
      await api.deleteTracker(trackerId);
      setLocalTrackers((prev) => prev.filter((tr) => (tr._id || tr.id) !== trackerId));
      setTrackers((prev) => prev.filter((tr) => (tr._id || tr.id) !== trackerId));
      if (addToast) addToast(t.trackerDeleted, "success");
    } catch {
      if (addToast) addToast(t.deleteFailed, "error");
    } finally {
      setDeleting(null);
    }
  }

  async function handleCrawl(trackerId) {
    if (!trackerId) return;
    setCrawling(trackerId);
    try {
      const data = await api.crawlTracker(trackerId, locale);
      setLocalTrackers((prev) => prev.map((tr) => ((tr._id || tr.id) === trackerId ? data.tracker : tr)));
      setTrackers((prev) => prev.map((tr) => ((tr._id || tr.id) === trackerId ? data.tracker : tr)));
      if (addToast) addToast(`${t.crawlComplete}：${data.crawl?.paperCount || 0} ${isZh ? "篇论文" : "papers"}`, "success");
    } catch (e) {
      if (e.message?.includes("already in progress")) {
        if (addToast) addToast(t.crawlInProgress, "warn");
      } else {
        if (addToast) addToast(e.message || t.crawlFailed, "error");
      }
    } finally {
      setCrawling(null);
    }
  }

  async function openTrackerDetail(trackerId) {
    if (!trackerId) return;
    setSelectedTrackerId(trackerId);
    setTrackerDetail(null);
    setDetailError("");
    setActivePdf(null);
    setDetailLoading(true);
    try {
      const detail = await api.fetchTrackerDetail(trackerId);
      setTrackerDetail(detail);
    } catch (e) {
      setDetailError(e.message || (isZh ? "加载详情失败" : "Failed to load tracker detail"));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeTrackerDetail() {
    setSelectedTrackerId(null);
    setTrackerDetail(null);
    setDetailError("");
    setActivePdf(null);
  }

  async function handleAnalyzePaper(paperId) {
    if (!paperId) return;
    setAnalyzing(paperId);
    try {
      await api.analyzePaper(paperId);
      if (addToast) addToast(t.aiReadingQueued, "success");
    } catch (e) {
      if (addToast) addToast(e.message || t.aiReadingFailed, "error");
    } finally {
      setAnalyzing(null);
    }
  }

  function startEdit(tr) {
    setEditingId(tr._id || tr.id);
    setEditForm({
      name: tr.name,
      keywords: (tr.keywords || []).join(", "),
      cadence: tr.cadence || "Daily",
      active: tr.active !== false,
    });
  }

  function cancelEdit() { setEditingId(null); setEditForm({}); }

  async function saveEdit(id) {
    setSaving(true);
    try {
      const data = await api.updateTracker(id, {
        name: editForm.name,
        keywords: editForm.keywords.split(",").map((s) => s.trim()).filter(Boolean),
        cadence: editForm.cadence,
        active: editForm.active,
      });
      setLocalTrackers((prev) => prev.map((tr) => ((tr._id || tr.id) === id ? data.tracker : tr)));
      setTrackers((prev) => prev.map((tr) => ((tr._id || tr.id) === id ? data.tracker : tr)));
      setEditingId(null);
      if (addToast) addToast(t.trackerUpdated, "success");
    } catch (e) {
      if (addToast) addToast(t.updateFailed || e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function crawlStatusLabel(status) {
    const labels = {
      completed: t.statusCompleted,
      partial: t.statusPartial,
      failed: t.statusFailed,
      running: t.statusRunning,
      idle: t.statusIdle,
    };
    return labels[status] || labels.idle;
  }

  if (error) return <ErrorDisplay message={error} />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-main">{t.trackers}</h2>
          <p className="text-sm text-muted mt-0.5">
            {pagination
              ? `${pagination.total} ${isZh ? "个追踪器" : "trackers"}`
              : trackers.length > 0
                ? `${trackers.length} ${t.activeTrackersCount}`
                : t.noTrackersYet}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" type="button" onClick={() => { setInput(quickPrompts.tracker[locale]); setActiveView("ai"); }}>
            <Sparkles className="h-4 w-4" />
            {t.aiCreate}
          </button>
          <button className="btn-primary" type="button" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t.quickCreate}
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder={t.searchTrackers}
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {q && (
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-main" onClick={() => { setQ(""); setPage(1); fetchTrackers(1, ""); }}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Quick Create Modal */}
      {showCreate && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-main">{t.createTracker}</h3>
              <button className="btn-ghost h-8 w-8 p-0" onClick={() => setShowCreate(false)}><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleQuickCreate}>
              <label className="text-xs font-medium text-muted">{t.researchTopic}</label>
              <input className="input mt-1 mb-3" value={createTopic} onChange={(e) => setCreateTopic(e.target.value)} placeholder={t.topicPlaceholder} autoFocus />
              {createError && <div className="text-xs text-red-500 mb-3">{createError}</div>}
              <button className="btn-primary w-full" type="submit" disabled={creating || !createTopic.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {creating ? t.generating : t.generateTracker}
              </button>
            </form>
          </div>
        </>
      )}

      {selectedTrackerId && (
        <TrackerDetailPanel
          t={t}
          isZh={isZh}
          locale={locale}
          detail={trackerDetail}
          loading={detailLoading}
          error={detailError}
          activePdf={activePdf}
          setActivePdf={setActivePdf}
          analyzing={analyzing}
          onAnalyzePaper={handleAnalyzePaper}
          onClose={closeTrackerDetail}
          crawlStatusLabel={crawlStatusLabel}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          showLowRelevance={showLowRelevance}
          setShowLowRelevance={setShowLowRelevance}
        />
      )}

      {(isLoading || loading) ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      ) : trackers.length === 0 ? (
        <EmptyState icon={Radar} title={t.noTrackers} hint={t.noTrackersHint} />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {trackers.map((tr) => (
              <div key={tr._id || tr.id || tr.name} className="surface group relative">
                {editingId === (tr._id || tr.id) ? (
                  <div className="p-4 space-y-3">
                    <input className="w-full text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder={t.nameLabel} />
                    <input className="w-full text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2" value={editForm.keywords} onChange={(e) => setEditForm((f) => ({ ...f, keywords: e.target.value }))} placeholder={t.keywordsLabel} />
                    <select className="w-full text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2" value={editForm.cadence} onChange={(e) => setEditForm((f) => ({ ...f, cadence: e.target.value }))}>
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-dull">
                      <input type="checkbox" checked={editForm.active} onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))} />
                      {t.activeToggle}
                    </label>
                    <div className="flex gap-2 justify-end">
                      <button className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-zinc-800" onClick={cancelEdit}>{t.cancelEdit}</button>
                      <button className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50" onClick={() => saveEdit(tr._id || tr.id)} disabled={saving}>{saving ? t.saving : <><Save className="h-3 w-3 inline mr-1" />{t.saveChanges}</>}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-4 cursor-pointer" role="button" tabIndex={0} onClick={() => openTrackerDetail(tr._id || tr.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTrackerDetail(tr._id || tr.id); } }}>
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-sm font-semibold text-main line-clamp-2 leading-snug pr-6">{tr.name}</h3>
                        <span className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">{tr.papers ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted mb-3 flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{tr.cadence || "Daily"}</span>
                        {tr.subscribers != null && <><span className="text-faint">&middot;</span><span>{tr.subscribers} {t.subscribersCount}</span></>}
                        {tr.lastRun && <><span className="text-faint">&middot;</span><span>{new Date(tr.lastRun).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}</span></>}
                        {tr.active === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700">{t.paused}</span>}
                        {tr.crawlStatus && <><span className="text-faint">&middot;</span><span>{crawlStatusLabel(tr.crawlStatus)}</span></>}
                      </div>
                      {tr.keywords && tr.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {tr.keywords.slice(0, 6).map((kw) => (<span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-muted">{kw}</span>))}
                          {tr.keywords.length > 6 && <span className="text-[10px] text-muted">+{tr.keywords.length - 6}</span>}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 mb-3">{(tr.sources || []).map((s) => (<span key={s} className="badge">{s}</span>))}</div>
                      {(tr.signals || []).length > 0 && (
                        <div className="space-y-1 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                          <div className="text-[10px] font-medium text-muted uppercase tracking-wider mb-2">{t.signals}</div>
                          {(tr.signals || []).slice(0, 5).map((sig) => (
                            <div key={sig} className="flex items-center gap-2 text-xs text-dull py-0.5"><Sparkles className="h-3 w-3 text-amber-500 shrink-0" /><span className="line-clamp-1">{sig}</span></div>
                          ))}
                          {(tr.signals || []).length > 5 && <div className="text-[10px] text-muted pl-5">+{(tr.signals || []).length - 5} more</div>}
                        </div>
                      )}
                    </div>
                    {/* Action buttons */}
                    {user && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button className="btn-ghost h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted hover:text-emerald-500 transition-all" onClick={(e) => { e.stopPropagation(); handleCrawl(tr._id || tr.id); }} disabled={crawling === (tr._id || tr.id) || tr.crawlStatus === "running"} title={t.runCrawl} type="button">
                          {crawling === (tr._id || tr.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </button>
                        <button className="btn-ghost h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted hover:text-blue-500 transition-all" onClick={(e) => { e.stopPropagation(); startEdit(tr); }} title={t.edit} type="button">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn-ghost h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-all" onClick={(e) => { e.stopPropagation(); handleDelete(tr._id || tr.id); }} disabled={deleting === (tr._id || tr.id)} title={t.delete} type="button">
                          {deleting === (tr._id || tr.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6 pb-2">
              <button className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />{t.prev}
              </button>
              <span className="text-xs text-muted px-2">{t.page} {page}/{pagination.totalPages}</span>
              <button className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30" disabled={page >= pagination.totalPages} onClick={() => goToPage(page + 1)}>
                {t.next}<ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TrackerDetailPanel({ t, isZh, locale, detail, loading, error, activePdf, setActivePdf, analyzing, onAnalyzePaper, onClose, crawlStatusLabel, categoryFilter, setCategoryFilter, showLowRelevance, setShowLowRelevance }) {
  const tracker = detail?.tracker;
  const crawl = detail?.crawl || {};
  const allPapers = detail?.papers || [];
  const repositories = detail?.repositories || [];
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";

  const triagedPapers = allPapers.filter((p) => p.status === "triaged");
  const triage = detail?.triage || (triagedPapers.length > 0 ? {
    totalCrawled: allPapers.length,
    triaged: triagedPapers.length,
    relevant: triagedPapers.filter((p) => (p.triageRelevance || 0) >= 5).length,
    breakthroughs: triagedPapers.filter((p) => p.triageNovelty === "breakthrough").length,
  } : null);

  const visiblePapers = categoryFilter === "all" ? allPapers : allPapers.filter((p) => p.triageCategory === categoryFilter);

  const relevantPapers = visiblePapers.filter((p) => p.status !== "triaged" || (p.triageRelevance != null && p.triageRelevance >= 5));
  const lowRelPapers = visiblePapers.filter((p) => p.status === "triaged" && p.triageRelevance != null && p.triageRelevance < 5);

  const categories = [...new Set(allPapers.map((p) => p.triageCategory).filter(Boolean))];
  const categoryCounts = {};
  for (const cat of categories) categoryCounts[cat] = allPapers.filter((p) => p.triageCategory === cat).length;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-3 top-4 bottom-4 z-50 mx-auto flex w-[min(1180px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-4 dark:border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted"><Activity className="h-3.5 w-3.5" />{t.trackerDetail}</div>
            <h3 className="mt-1 line-clamp-2 text-base font-semibold text-main">{tracker?.name || t.loading}</h3>
          </div>
          <button className="btn-ghost h-8 w-8 p-0" type="button" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted"><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.loadingTrackerDetail}</div>
        ) : error ? (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</div>
        ) : (
          <div className="grid flex-1 min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[360px_1fr]">
            <aside className="overflow-auto border-b border-gray-200 p-4 dark:border-white/10 lg:border-b-0 lg:border-r">
              <div className="grid grid-cols-2 gap-2">
                <Metric label={t.status} value={crawlStatusLabel(crawl.status || tracker?.crawlStatus)} />
                <Metric label={t.papers_} value={String(crawl.paperCount ?? allPapers.length)} />
                <Metric label={t.repos_} value={String(crawl.repositoryCount ?? repositories.length)} />
                <Metric label={t.cadence_} value={tracker?.cadence || "Daily"} />
              </div>

              {triage && (
                <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs dark:bg-emerald-500/10">
                  <div className="font-medium text-emerald-800 dark:text-emerald-300">{isZh ? "AI 筛选完成" : "AI Triage Complete"}</div>
                  <div className="mt-1.5 space-y-0.5 text-emerald-700 dark:text-emerald-400">
                    <div>{isZh ? "抓取" : "Crawled"}: {triage.totalCrawled}</div>
                    <div>{isZh ? "已筛选" : "Triaged"}: {triage.triaged}</div>
                    <div className="font-medium">{isZh ? "相关" : "Relevant"}: {triage.relevant}</div>
                    {triage.breakthroughs > 0 && <div className="font-semibold text-amber-600 dark:text-amber-400">{isZh ? "突破性" : "Breakthroughs"}: {triage.breakthroughs}</div>}
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-3 text-xs">
                <InfoLine label={t.lastRun_} value={tracker?.lastRun ? new Date(tracker.lastRun).toLocaleString(dateLocale) : "-"} />
                <InfoLine label={t.query_} value={crawl.query || tracker?.lastCrawlQuery || "-"} />
                <InfoLine label={t.subscribers_} value={String(tracker?.subscribers ?? 0)} />
              </div>

              {(tracker?.keywords || []).length > 0 && <ChipSection title={t.keywords_} values={tracker.keywords} />}
              {(tracker?.sources || []).length > 0 && <ChipSection title={t.sources_} values={tracker.sources} />}

              {(tracker?.signals || []).length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">{t.signals}</div>
                  <div className="space-y-1.5">
                    {tracker.signals.map((signal) => (
                      <div key={signal} className="flex items-center gap-2 text-xs text-dull"><Sparkles className="h-3 w-3 shrink-0 text-amber-500" /><span>{signal}</span></div>
                    ))}
                  </div>
                </div>
              )}

              {(crawl.errors || []).length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <div className="mb-2 flex items-center gap-2 font-medium"><AlertCircle className="h-3.5 w-3.5" />{t.runErrors}</div>
                  <div className="space-y-1">{crawl.errors.map((item) => (<div key={`${item.source}-${item.error}`}>{item.source}: {item.error}</div>))}</div>
                </div>
              )}
            </aside>

            <main className="min-h-0 overflow-auto p-4">
              {activePdf && (
                <section className="mb-4 overflow-hidden rounded-lg border border-gray-200 dark:border-white/10">
                  <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-white/10">
                    <div className="min-w-0 text-xs font-medium text-dull"><FileText className="mr-1.5 inline h-3.5 w-3.5" /><span className="align-middle">{activePdf.title}</span></div>
                    <button className="btn-ghost h-7 w-7 p-0" type="button" onClick={() => setActivePdf(null)}><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <iframe className="h-[420px] w-full bg-gray-50 dark:bg-zinc-900" src={activePdf.pdfUrl} title={activePdf.title} />
                </section>
              )}

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-main"><BookOpen className="h-4 w-4" />{t.trackingPapers}</h4>
                  <span className="text-xs text-muted">{relevantPapers.length}{lowRelPapers.length > 0 ? ` + ${lowRelPapers.length}` : ""} / {allPapers.length}</span>
                </div>

                {categories.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <button className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${categoryFilter === "all" ? "bg-ink text-white dark:bg-white dark:text-ink" : "bg-gray-100 text-dull hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10"}`} onClick={() => setCategoryFilter("all")}>{t.showCategory} ({allPapers.length})</button>
                    {categories.map((cat) => (
                      <button key={cat} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${categoryFilter === cat ? "bg-ink text-white dark:bg-white dark:text-ink" : "bg-gray-100 text-dull hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10"}`} onClick={() => setCategoryFilter(cat)}>{cat} ({categoryCounts[cat]})</button>
                    ))}
                  </div>
                )}

                {visiblePapers.length === 0 ? (
                  <EmptySmall text={t.noPapersInTracker} />
                ) : (
                  <div className="space-y-2">
                    {relevantPapers.map((paper) => (
                      <PaperRow key={paper._id || paper.title} paper={paper} t={t} isZh={isZh} analyzing={analyzing === paper._id} onViewPdf={() => setActivePdf(paper)} onAnalyze={() => onAnalyzePaper(paper._id)} />
                    ))}
                    {lowRelPapers.length > 0 && (
                      <div className="mt-3 border-t border-gray-200 pt-2 dark:border-white/10">
                        <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-muted hover:bg-gray-50 dark:hover:bg-white/5" onClick={() => setShowLowRelevance(!showLowRelevance)}>
                          <span>{t.showLowRelevance} ({lowRelPapers.length})</span>
                          <span className="text-[10px]">{showLowRelevance ? "▲" : "▼"}</span>
                        </button>
                        {showLowRelevance && <div className="mt-2 space-y-2">{lowRelPapers.map((paper) => (<PaperRow key={paper._id || paper.title} paper={paper} t={t} isZh={isZh} analyzing={analyzing === paper._id} onViewPdf={() => setActivePdf(paper)} onAnalyze={() => onAnalyzePaper(paper._id)} />))}</div>}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-main"><Github className="h-4 w-4" />{t.trackedRepos}</h4>
                  <span className="text-xs text-muted">{repositories.length}</span>
                </div>
                {repositories.length === 0 ? (
                  <EmptySmall text={t.noReposInTracker} />
                ) : (
                  <div className="space-y-2">{repositories.map((repo) => (<RepoRow key={repo._id || repo.url || repo.title} repo={repo} t={t} isZh={isZh} />))}</div>
                )}
              </section>
            </main>
          </div>
        )}
      </div>
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-main">{value || "-"}</div>
    </div>
  );
}

function InfoLine({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 break-words text-dull">{value}</div>
    </div>
  );
}

function ChipSection({ title, values }) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">{title}</div>
      <div className="flex flex-wrap gap-1">{values.map((value) => <span key={value} className="badge">{value}</span>)}</div>
    </div>
  );
}

function PaperRow({ paper, t, isZh, analyzing, onViewPdf, onAnalyze }) {
  const rel = paper.triageRelevance;
  const category = paper.triageCategory;
  const novelty = paper.triageNovelty;
  const reasoning = paper.triageReasoning;
  const isTriaged = paper.status === "triaged";

  const relBadge = rel >= 8
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400"
    : rel >= 5
    ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400"
    : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400";

  const noveltyBadge = novelty === "breakthrough"
    ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-300 dark:border-amber-600"
    : "";

  const categoryLabel = {
    method: isZh ? "方法" : "Method",
    application: isZh ? "应用" : "Application",
    theory: isZh ? "理论" : "Theory",
    survey: isZh ? "综述" : "Survey",
    dataset: isZh ? "数据集" : "Dataset",
    tool: isZh ? "工具" : "Tool",
    unrelated: isZh ? "无关" : "Unrelated",
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h5 className="line-clamp-2 text-sm font-semibold text-main">{paper.title}</h5>
          <p className="mt-1 text-xs text-muted">{[paper.source, paper.year, isTriaged ? (isZh ? "已筛选" : "Triaged") : paper.status].filter(Boolean).join(" · ")}</p>
          {(paper.summary || paper.abstract) && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-dull">{paper.summary || paper.abstract}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {isTriaged && rel != null && <span className={`badge text-[11px] font-medium ${relBadge}`} title={reasoning || ""}>{t.relevance} {rel}/10</span>}
            {isTriaged && category && category !== "unrelated" && <span className="badge bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">{categoryLabel[category] || category}</span>}
            {isTriaged && novelty && novelty !== "unknown" && novelty !== "incremental" && (
              <span className={`badge text-[11px] font-semibold ${noveltyBadge}`}>{novelty === "breakthrough" ? t.breakthrough : t.interesting}</span>
            )}
            {(paper.tags || []).slice(0, isTriaged ? 3 : 5).map((tag) => <span key={tag} className="badge">{tag}</span>)}
            <span className={`badge ${paper.hasPdf ? "text-emerald-700 dark:text-emerald-400" : ""}`}>{paper.hasPdf ? t.pdfStored : t.noPdf}</span>
            <span className="badge">{paper.summary ? t.summarized : t.needsSummary}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {paper.hasPdf && <button className="btn-secondary h-8 px-2 text-xs" type="button" onClick={onViewPdf}><Eye className="h-3.5 w-3.5" />{t.view}</button>}
          <button className="btn-secondary h-8 px-2 text-xs" type="button" onClick={onAnalyze} disabled={analyzing}>
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
            {t.aiReadButton}
          </button>
        </div>
      </div>
    </div>
  );
}

function RepoRow({ repo, t, isZh }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h5 className="line-clamp-1 text-sm font-semibold text-main">{repo.title}</h5>
          <p className="mt-1 text-xs text-muted">{[repo.language, `${repo.stars || 0} stars`, repo.forks ? `${repo.forks} forks` : ""].filter(Boolean).join(" · ")}</p>
          {(repo.summary || repo.abstract) && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-dull">{repo.summary || repo.abstract}</p>}
        </div>
        {repo.url && <a className="btn-secondary h-8 px-2 text-xs" href={repo.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />{t.open}</a>}
      </div>
    </div>
  );
}

function EmptySmall({ text }) {
  return <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-muted dark:border-white/10">{text}</div>;
}
