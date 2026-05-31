import React, { useState, useCallback } from "react";
import { Upload, Share2, Bookmark, ExternalLink, Search, FileText, Plus, Loader2, BookOpen, ArrowUpDown } from "lucide-react";
import { CardSkeleton, EmptyState, ErrorDisplay } from "../LoadingStates.jsx";
import { sharingLabel } from "../../utils/sharingLabel.js";
import { api } from "../../utils/api.js";

export default function LibraryView({ t, locale, papers, onUpload, onSelectPaper, isLoading, error, addToast }) {
  const isZh = locale === "zh";
  const [activeTab, setActiveTab] = useState("library"); // library | search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [sort, setSort] = useState("cited_by_count:desc");
  const [savingIds, setSavingIds] = useState(new Set());

  const handleSearch = useCallback(async (page = 1) => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const data = await api.searchPapers(searchQuery, { page, sort, perPage: 15 });
      setSearchResults(data.results || []);
      setSearchTotal(data.totalResults || 0);
      setSearchPage(page);
    } catch (err) {
      setSearchError(err.message || (isZh ? "搜索失败" : "Search failed"));
    } finally {
      setSearching(false);
    }
  }, [searchQuery, sort, isZh]);

  async function handleSavePaper(paper) {
    const key = paper.doi || paper.title;
    setSavingIds((prev) => new Set([...prev, key]));
    try {
      const result = await api.savePaper(paper);
      if (result.duplicate) {
        addToast?.(isZh ? "论文已存在于文库中" : "Paper already exists in library", "info");
      } else {
        addToast?.(isZh ? "论文已添加到文库" : "Paper added to library", "success");
      }
    } catch (err) {
      addToast?.(err.message || (isZh ? "保存失败" : "Save failed"), "error");
    } finally {
      setSavingIds((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  }

  function openPdf(url) {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  if (error) return <ErrorDisplay message={error} />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-main">{t.library}</h2>
          <p className="text-sm text-muted mt-0.5">{t.sourceMemory}</p>
        </div>
        <span className="text-xs text-muted">{papers.length} {isZh ? "篇论文" : "papers"}</span>
      </div>

      {/* Tabs: My Library | Search Papers */}
      <div className="flex rounded-lg bg-gray-100 dark:bg-white/5 p-0.5 mb-4 max-w-sm">
        <button
          className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === "library" ? "bg-white dark:bg-zinc-800 text-main shadow-sm" : "text-muted hover:text-dull"
          }`}
          onClick={() => setActiveTab("library")}
        >
          <Bookmark className="h-3.5 w-3.5" />
          {isZh ? "我的文库" : "My Library"}
        </button>
        <button
          className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === "search" ? "bg-white dark:bg-zinc-800 text-main shadow-sm" : "text-muted hover:text-dull"
          }`}
          onClick={() => setActiveTab("search")}
        >
          <Search className="h-3.5 w-3.5" />
          {isZh ? "搜索论文" : "Search Papers"}
        </button>
      </div>

      {/* ═══════════ SEARCH TAB ═══════════ */}
      {activeTab === "search" && (
        <div className="space-y-4">
          {/* Search bar */}
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(1); }} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className="input pl-9 pr-3"
                type="text"
                placeholder={isZh ? "搜索研究论文（例如：multi-agent reinforcement learning）" : "Search research papers (e.g., multi-agent reinforcement learning)"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-lg px-2"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="cited_by_count:desc">{isZh ? "引用量↓" : "Citations ↓"}</option>
              <option value="publication_date:desc">{isZh ? "最新优先" : "Newest first"}</option>
              <option value="relevance_score:desc">{isZh ? "相关性" : "Relevance"}</option>
            </select>
            <button className="btn-primary px-4" type="submit" disabled={searching || !searchQuery.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </form>

          {/* Search error */}
          {searchError && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
              {searchError}
            </div>
          )}

          {/* Search results */}
          {searching ? (
            <div className="space-y-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
          ) : searchResults.length > 0 ? (
            <>
              <div className="text-xs text-muted">
                {isZh
                  ? `找到 ${searchTotal.toLocaleString()} 篇论文（显示第 ${searchPage} 页）`
                  : `Found ${searchTotal.toLocaleString()} papers (page ${searchPage})`}
              </div>
              <div className="space-y-3">
                {searchResults.map((paper, idx) => {
                  const key = paper.doi || paper.title || idx;
                  const isSaving = savingIds.has(paper.doi || paper.title);
                  return (
                    <div key={key} className="surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-main line-clamp-2 leading-snug">{paper.title}</h3>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted">
                            {paper.authors?.length > 0 && <span>{paper.authors.slice(0, 3).join(", ")}{paper.authors.length > 3 ? " et al." : ""}</span>}
                            {paper.year && <span>· {paper.year}</span>}
                            {paper.journal && <span>· {paper.journal}</span>}
                            {paper.citedByCount > 0 && <span>· {isZh ? `引用 ${paper.citedByCount}` : `${paper.citedByCount} citations`}</span>}
                          </div>
                          {paper.abstract && <p className="text-xs text-muted mt-2 line-clamp-3 leading-relaxed">{paper.abstract}</p>}
                          {paper.doi && (
                            <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-muted hover:text-emerald-600 transition-colors">
                              <ExternalLink className="h-3 w-3" />{paper.doi}
                            </a>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          {/* Open PDF button */}
                          {paper.pdfUrl ? (
                            <button
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                              onClick={() => openPdf(paper.pdfUrl)}
                              title={isZh ? "在新标签页打开 PDF" : "Open PDF in new tab"}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              PDF
                            </button>
                          ) : paper.url ? (
                            <button
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-white/5 text-muted hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                              onClick={() => openPdf(paper.url)}
                              title={isZh ? "查看原文" : "View source"}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {isZh ? "原文" : "View"}
                            </button>
                          ) : null}
                          {/* Save to library button */}
                          <button
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                            onClick={() => handleSavePaper(paper)}
                            disabled={isSaving}
                            title={isZh ? "添加到文库" : "Add to library"}
                          >
                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            {isZh ? "收藏" : "Save"}
                          </button>
                          {/* Open Access badge */}
                          {paper.isOpenAccess && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium text-center">
                              {isZh ? "开放获取" : "Open Access"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {searchTotal > 15 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    className="btn-ghost text-xs px-3 py-1.5"
                    onClick={() => handleSearch(searchPage - 1)}
                    disabled={searchPage <= 1 || searching}
                  >
                    {isZh ? "上一页" : "Previous"}
                  </button>
                  <span className="text-xs text-muted">
                    {isZh ? `第 ${searchPage} 页` : `Page ${searchPage}`}
                  </span>
                  <button
                    className="btn-ghost text-xs px-3 py-1.5"
                    onClick={() => handleSearch(searchPage + 1)}
                    disabled={searchPage * 15 >= searchTotal || searching}
                  >
                    {isZh ? "下一页" : "Next"}
                  </button>
                </div>
              )}
            </>
          ) : searchQuery && !searching ? (
            <EmptyState icon={Search} title={isZh ? "未找到论文" : "No papers found"} hint={isZh ? "尝试不同的关键词" : "Try different keywords"} />
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-10 w-10 text-muted mx-auto mb-3" />
              <p className="text-sm text-muted">{isZh ? "搜索 OpenAlex 数据库中的研究论文" : "Search research papers from the OpenAlex database"}</p>
              <p className="text-xs text-faint mt-1">{isZh ? "超过 2.5 亿篇学术论文" : "Over 250 million scholarly works"}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ LIBRARY TAB ═══════════ */}
      {activeTab === "library" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            {isLoading ? <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
             : papers.length === 0 ? <EmptyState icon={Bookmark} title={t.noPapers} hint={t.noPapersHint} />
             : papers.map((paper) => (
              <div key={paper._id || paper.title} className="surface-hover cursor-pointer" onClick={() => onSelectPaper?.(paper._id || paper.title)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onSelectPaper?.(paper._id || paper.title); }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-main line-clamp-2 leading-snug">{paper.title}</h3>
                    <p className="text-xs text-muted mt-1">{paper.area} &middot; {paper.source}</p>
                    {paper.abstract && <p className="text-xs text-muted mt-2 line-clamp-2 leading-relaxed">{paper.abstract}</p>}
                    {paper.doi && (
                      <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="h-3 w-3" />{paper.doi}
                      </a>
                    )}
                    <div className="flex flex-wrap gap-1 mt-3">{(paper.tags||[]).map((tag) => (<span key={tag} className="badge">{tag}</span>))}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{paper.score}</span>
                    <span className="badge">{sharingLabel(t, paper.sharing)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="space-y-3">
            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-white/10 p-8 text-center cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/[0.03] transition-all">
              <Upload className="h-6 w-6 text-muted mb-2" />
              <span className="text-sm font-medium text-dull">{t.uploadPdf}</span>
              <span className="text-xs text-muted mt-1">{t.pdfQueue}</span>
              <input className="hidden" type="file" accept="application/pdf" multiple onChange={(e) => onUpload(e.target.files)} />
            </label>
            <div className="surface p-4">
              <div className="flex items-center gap-2 mb-3 text-xs font-medium uppercase tracking-wider text-muted"><Share2 className="h-3.5 w-3.5" />{t.sharingPolicy}</div>
              <div className="space-y-1.5">
                {[t.schoolShared,t.private,t.projectShared,t.universityShared].map((item,i) => (
                  <div key={item} className={`text-xs px-2.5 py-2 rounded-lg ${i===0?'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium':'text-dull'}`}>{item}</div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
