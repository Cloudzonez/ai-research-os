import React, { useState } from "react";
import { Plus, Sparkles, Clock, Trash2, Radar, Loader2, X, Check, RefreshCw, Activity, AlertCircle, Bot, BookOpen, ExternalLink, Eye, FileText, Github } from "lucide-react";
import { CardSkeleton, EmptyState, ErrorDisplay } from "../LoadingStates.jsx";
import quickPrompts from "../../data/quickPrompts.js";
import { api } from "../../utils/api.js";

export default function TrackersView({ t, trackers, setTrackers, setInput, setActiveView, locale, isLoading, error, addToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [createTopic, setCreateTopic] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [crawling, setCrawling] = useState(null);
  const [selectedTrackerId, setSelectedTrackerId] = useState(null);
  const [trackerDetail, setTrackerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [activePdf, setActivePdf] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);
  const isZh = locale === "zh";

  if (error) return <ErrorDisplay message={error} />;

  async function handleQuickCreate(e) {
    e.preventDefault();
    const topic = createTopic.trim();
    if (!topic) return;
    setCreating(true);
    setCreateError("");
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/trackers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic, locale }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Generation failed");
      }
      const data = await res.json();
      setTrackers((prev) => [data.tracker, ...prev]);
      setCreateTopic("");
      setShowCreate(false);
      if (addToast) addToast(isZh ? "追踪器已创建" : "Tracker created", "success");
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(trackerId) {
    if (!trackerId) return;
    if (!confirm(isZh ? "确定删除此追踪器？" : "Delete this tracker?")) return;
    setDeleting(trackerId);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/trackers/${trackerId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      setTrackers((prev) => prev.filter((tr) => (tr._id || tr.id) !== trackerId));
      if (addToast) addToast(isZh ? "追踪器已删除" : "Tracker deleted", "success");
    } catch {
      if (addToast) addToast(isZh ? "删除失败" : "Delete failed", "error");
    } finally {
      setDeleting(null);
    }
  }

  async function handleCrawl(trackerId) {
    if (!trackerId) return;
    setCrawling(trackerId);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/trackers/${trackerId}/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Crawl failed" }));
        throw new Error(err.error || "Crawl failed");
      }
      const data = await res.json();
      setTrackers((prev) => prev.map((tr) => ((tr._id || tr.id) === trackerId ? data.tracker : tr)));
      if (addToast) addToast(isZh ? `抓取完成：${data.crawl?.paperCount || 0} 篇论文` : `Crawl complete: ${data.crawl?.paperCount || 0} papers`, "success");
    } catch (e) {
      if (addToast) addToast(e.message || (isZh ? "抓取失败" : "Crawl failed"), "error");
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
      if (addToast) addToast(isZh ? "AI 阅读已加入队列" : "AI reading queued", "success");
    } catch (e) {
      if (addToast) addToast(e.message || (isZh ? "AI 阅读启动失败" : "AI reading failed to start"), "error");
    } finally {
      setAnalyzing(null);
    }
  }

  function crawlStatusLabel(status) {
    const labels = {
      completed: isZh ? "已完成" : "Completed",
      partial: isZh ? "部分完成" : "Partial",
      failed: isZh ? "失败" : "Failed",
      running: isZh ? "抓取中" : "Running",
      idle: isZh ? "待运行" : "Idle",
    };
    return labels[status] || labels.idle;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-main">{t.trackers}</h2>
          <p className="text-sm text-muted mt-0.5">
            {trackers.length > 0
              ? `${trackers.length} ${isZh ? "个追踪器运行中" : "active trackers"}`
              : (isZh ? "暂无追踪器" : "No trackers yet")}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" type="button" onClick={() => { setInput(quickPrompts.tracker[locale]); setActiveView("ai"); }}>
            <Sparkles className="h-4 w-4" />
            {isZh ? "AI 创建" : "AI Create"}
          </button>
          <button className="btn-primary" type="button" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {isZh ? "快速创建" : "Quick Create"}
          </button>
        </div>
      </div>

      {/* Quick Create Modal */}
      {showCreate && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-main">
                {isZh ? "创建论文追踪器" : "Create Paper Tracker"}
              </h3>
              <button className="btn-ghost h-8 w-8 p-0" onClick={() => setShowCreate(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleQuickCreate}>
              <label className="text-xs font-medium text-muted">
                {isZh ? "研究主题" : "Research Topic"}
              </label>
              <input
                className="input mt-1 mb-3"
                value={createTopic}
                onChange={(e) => setCreateTopic(e.target.value)}
                placeholder={isZh ? "例如：大语言模型在数学教育中的应用" : "e.g., Large language models in math education"}
                autoFocus
              />
              {createError && (
                <div className="text-xs text-red-500 mb-3">{createError}</div>
              )}
              <button className="btn-primary w-full" type="submit" disabled={creating || !createTopic.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {creating ? (isZh ? "生成中..." : "Generating...") : (isZh ? "生成追踪器" : "Generate Tracker")}
              </button>
            </form>
          </div>
        </>
      )}

      {selectedTrackerId && (
        <TrackerDetailPanel
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
        />
      )}

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      ) : trackers.length === 0 ? (
        <EmptyState icon={Radar} title={t.noTrackers} hint={t.noTrackersHint} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {trackers.map((tr) => (
            <div
              key={tr._id || tr.id || tr.name}
              role="button"
              tabIndex={0}
              className="surface hover:border-emerald-200 dark:hover:border-emerald-500/20 transition-colors group relative text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              onClick={() => openTrackerDetail(tr._id || tr.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openTrackerDetail(tr._id || tr.id);
                }
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-main line-clamp-2 leading-snug pr-6">{tr.name}</h3>
                <div className="absolute top-0 right-0 flex items-center gap-1">
                  <span className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {tr.papers ?? 0}
                  </span>
                  <button
                    className="btn-ghost h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted hover:text-emerald-500 transition-all"
                    onClick={(e) => { e.stopPropagation(); handleCrawl(tr._id || tr.id); }}
                    disabled={crawling === (tr._id || tr.id)}
                    title={isZh ? "运行抓取" : "Run crawl"}
                    type="button"
                  >
                    {crawling === (tr._id || tr.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    className="btn-ghost h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-all"
                    onClick={(e) => { e.stopPropagation(); handleDelete(tr._id || tr.id); }}
                    disabled={deleting === (tr._id || tr.id)}
                    title={isZh ? "删除" : "Delete"}
                    type="button"
                  >
                    {deleting === (tr._id || tr.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-2 text-xs text-muted mb-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />{tr.cadence || "Daily"}
                </span>
                {tr.subscribers != null && (
                  <>
                    <span className="text-faint">&middot;</span>
                    <span>{tr.subscribers} {isZh ? "订阅" : "subscribers"}</span>
                  </>
                )}
                {tr.lastRun && (
                  <>
                    <span className="text-faint">&middot;</span>
                    <span>{new Date(tr.lastRun).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}</span>
                  </>
                )}
                {tr.active === false && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700">{isZh ? "已暂停" : "Paused"}</span>
                )}
                {tr.crawlStatus && (
                  <>
                    <span className="text-faint">&middot;</span>
                    <span>{crawlStatusLabel(tr.crawlStatus)}</span>
                  </>
                )}
              </div>

              {/* Keywords */}
              {tr.keywords && tr.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {tr.keywords.slice(0, 6).map((kw) => (
                    <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-muted">{kw}</span>
                  ))}
                  {tr.keywords.length > 6 && (
                    <span className="text-[10px] text-muted">+{tr.keywords.length - 6}</span>
                  )}
                </div>
              )}

              {/* Sources */}
              <div className="flex flex-wrap gap-1 mb-3">
                {(tr.sources || []).map((s) => (
                  <span key={s} className="badge">{s}</span>
                ))}
              </div>

              {/* Signals */}
              {(tr.signals || []).length > 0 && (
                <div className="space-y-1 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                  <div className="text-[10px] font-medium text-muted uppercase tracking-wider mb-2">
                    {isZh ? "追踪信号" : "Signals"}
                  </div>
                  {(tr.signals || []).slice(0, 5).map((sig) => (
                    <div key={sig} className="flex items-center gap-2 text-xs text-dull py-0.5">
                      <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="line-clamp-1">{sig}</span>
                    </div>
                  ))}
                  {(tr.signals || []).length > 5 && (
                    <div className="text-[10px] text-muted pl-5">+{(tr.signals || []).length - 5} more</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrackerDetailPanel({
  isZh,
  locale,
  detail,
  loading,
  error,
  activePdf,
  setActivePdf,
  analyzing,
  onAnalyzePaper,
  onClose,
  crawlStatusLabel,
}) {
  const tracker = detail?.tracker;
  const crawl = detail?.crawl || {};
  const papers = detail?.papers || [];
  const repositories = detail?.repositories || [];
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-3 top-4 bottom-4 z-50 mx-auto flex w-[min(1180px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-4 dark:border-white/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Activity className="h-3.5 w-3.5" />
              {isZh ? "追踪器详情" : "Tracker detail"}
            </div>
            <h3 className="mt-1 line-clamp-2 text-base font-semibold text-main">
              {tracker?.name || (isZh ? "加载中..." : "Loading...")}
            </h3>
          </div>
          <button className="btn-ghost h-8 w-8 p-0" type="button" onClick={onClose} title={isZh ? "关闭" : "Close"}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isZh ? "加载追踪器运行信息..." : "Loading tracker run information..."}
          </div>
        ) : error ? (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        ) : (
          <div className="grid flex-1 min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[360px_1fr]">
            <aside className="overflow-auto border-b border-gray-200 p-4 dark:border-white/10 lg:border-b-0 lg:border-r">
              <div className="grid grid-cols-2 gap-2">
                <Metric label={isZh ? "状态" : "Status"} value={crawlStatusLabel(crawl.status || tracker?.crawlStatus)} />
                <Metric label={isZh ? "论文" : "Papers"} value={String(crawl.paperCount ?? papers.length)} />
                <Metric label={isZh ? "仓库" : "Repos"} value={String(crawl.repositoryCount ?? repositories.length)} />
                <Metric label={isZh ? "周期" : "Cadence"} value={tracker?.cadence || "Daily"} />
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <InfoLine label={isZh ? "上次运行" : "Last run"} value={tracker?.lastRun ? new Date(tracker.lastRun).toLocaleString(dateLocale) : "-"} />
                <InfoLine label={isZh ? "查询词" : "Query"} value={crawl.query || tracker?.lastCrawlQuery || "-"} />
                <InfoLine label={isZh ? "订阅数" : "Subscribers"} value={String(tracker?.subscribers ?? 0)} />
              </div>

              {(tracker?.keywords || []).length > 0 && (
                <ChipSection title={isZh ? "关键词" : "Keywords"} values={tracker.keywords} />
              )}
              {(tracker?.sources || []).length > 0 && (
                <ChipSection title={isZh ? "来源" : "Sources"} values={tracker.sources} />
              )}
              {(tracker?.signals || []).length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted">{isZh ? "追踪信号" : "Signals"}</div>
                  <div className="space-y-1.5">
                    {tracker.signals.map((signal) => (
                      <div key={signal} className="flex items-center gap-2 text-xs text-dull">
                        <Sparkles className="h-3 w-3 shrink-0 text-amber-500" />
                        <span>{signal}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(crawl.errors || []).length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <div className="mb-2 flex items-center gap-2 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {isZh ? "运行错误" : "Run errors"}
                  </div>
                  <div className="space-y-1">
                    {crawl.errors.map((item) => (
                      <div key={`${item.source}-${item.error}`}>{item.source}: {item.error}</div>
                    ))}
                  </div>
                </div>
              )}
            </aside>

            <main className="min-h-0 overflow-auto p-4">
              {activePdf && (
                <section className="mb-4 overflow-hidden rounded-lg border border-gray-200 dark:border-white/10">
                  <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-white/10">
                    <div className="min-w-0 text-xs font-medium text-dull">
                      <FileText className="mr-1.5 inline h-3.5 w-3.5" />
                      <span className="align-middle">{activePdf.title}</span>
                    </div>
                    <button className="btn-ghost h-7 w-7 p-0" type="button" onClick={() => setActivePdf(null)}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <iframe className="h-[420px] w-full bg-gray-50 dark:bg-zinc-900" src={activePdf.pdfUrl} title={activePdf.title} />
                </section>
              )}

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-main">
                    <BookOpen className="h-4 w-4" />
                    {isZh ? "追踪到的论文" : "Tracked papers"}
                  </h4>
                  <span className="text-xs text-muted">{papers.length}</span>
                </div>
                {papers.length === 0 ? (
                  <EmptySmall text={isZh ? "还没有抓取到论文。运行追踪器后会显示论文、摘要、PDF 与 AI 阅读状态。" : "No papers yet. Run the tracker to see papers, summaries, PDFs, and AI reading status."} />
                ) : (
                  <div className="space-y-2">
                    {papers.map((paper) => (
                      <PaperRow
                        key={paper._id || paper.title}
                        paper={paper}
                        isZh={isZh}
                        analyzing={analyzing === paper._id}
                        onViewPdf={() => setActivePdf(paper)}
                        onAnalyze={() => onAnalyzePaper(paper._id)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-main">
                    <Github className="h-4 w-4" />
                    {isZh ? "关联 GitHub 仓库" : "Tracked GitHub repositories"}
                  </h4>
                  <span className="text-xs text-muted">{repositories.length}</span>
                </div>
                {repositories.length === 0 ? (
                  <EmptySmall text={isZh ? "此追踪器暂未保存仓库结果。将 GitHub 加入来源并重新运行即可追踪仓库热度。" : "No repositories saved yet. Add GitHub as a source and rerun the tracker to monitor repository momentum."} />
                ) : (
                  <div className="space-y-2">
                    {repositories.map((repo) => (
                      <RepoRow key={repo._id || repo.url || repo.title} repo={repo} isZh={isZh} />
                    ))}
                  </div>
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
      <div className="flex flex-wrap gap-1">
        {values.map((value) => <span key={value} className="badge">{value}</span>)}
      </div>
    </div>
  );
}

function PaperRow({ paper, isZh, analyzing, onViewPdf, onAnalyze }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h5 className="line-clamp-2 text-sm font-semibold text-main">{paper.title}</h5>
          <p className="mt-1 text-xs text-muted">
            {[paper.source, paper.year, paper.status].filter(Boolean).join(" · ")}
          </p>
          {(paper.summary || paper.abstract) && (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-dull">{paper.summary || paper.abstract}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {(paper.tags || []).slice(0, 5).map((tag) => <span key={tag} className="badge">{tag}</span>)}
            <span className={`badge ${paper.hasPdf ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
              {paper.hasPdf ? (isZh ? "PDF 已存储" : "PDF stored") : (isZh ? "无 PDF" : "No PDF")}
            </span>
            <span className="badge">{paper.summary ? (isZh ? "已有摘要" : "Summarized") : (isZh ? "待摘要" : "Needs summary")}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {paper.hasPdf && (
            <button className="btn-secondary h-8 px-2 text-xs" type="button" onClick={onViewPdf}>
              <Eye className="h-3.5 w-3.5" />
              {isZh ? "查看" : "View"}
            </button>
          )}
          <button className="btn-secondary h-8 px-2 text-xs" type="button" onClick={onAnalyze} disabled={analyzing}>
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
            {isZh ? "AI 阅读" : "AI Read"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RepoRow({ repo, isZh }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h5 className="line-clamp-1 text-sm font-semibold text-main">{repo.title}</h5>
          <p className="mt-1 text-xs text-muted">
            {[repo.language, `${repo.stars || 0} stars`, repo.forks ? `${repo.forks} forks` : ""].filter(Boolean).join(" · ")}
          </p>
          {(repo.summary || repo.abstract) && (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-dull">{repo.summary || repo.abstract}</p>
          )}
        </div>
        {repo.url && (
          <a className="btn-secondary h-8 px-2 text-xs" href={repo.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            {isZh ? "打开" : "Open"}
          </a>
        )}
      </div>
    </div>
  );
}

function EmptySmall({ text }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-muted dark:border-white/10">
      {text}
    </div>
  );
}
