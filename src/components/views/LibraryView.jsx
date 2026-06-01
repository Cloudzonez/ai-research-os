import React, { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Share2, Bookmark, ExternalLink, Search, ChevronLeft, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { CardSkeleton, EmptyState, ErrorDisplay } from "../LoadingStates.jsx";
import { sharingLabel } from "../../utils/sharingLabel.js";
import { api } from "../../utils/api.js";

export default function LibraryView({ t, onUpload, onSelectPaper, error, refreshPapers }) {
  const [papers, setPapers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const searchTimer = useRef(null);

  const fetchPapers = useCallback(async (p, query) => {
    setLoading(true);
    try {
      const res = await api.fetchPapers({ page: p || page, q: query ?? q, limit: 20 });
      setPapers(res.papers);
      setPagination(res.pagination);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, q]);

  // Load paginated data on mount — don't sync from parent to avoid overwrites
  useEffect(() => {
    fetchPapers(1, "");
  }, []);

  const handleSearch = (val) => {
    setQ(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchPapers(1, val);
    }, 400);
  };

  const goToPage = (p) => { setPage(p); fetchPapers(p, q); };

  const handleDelete = async (id) => {
    if (!window.confirm(t.confirmDelete || "Delete this paper?")) return;
    setDeleting(id);
    try {
      await api.deletePaper(id);
      fetchPapers(page, q);
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  };

  if (error) return <ErrorDisplay message={error} />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-lg font-semibold text-main">{t.library}</h2><p className="text-sm text-muted mt-0.5">{t.sourceMemory}</p></div>
        <span className="text-xs text-muted">{pagination ? `${pagination.total} papers` : `${papers.length} papers`}</span>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-white/5 bg-white dark:bg-zinc-900 text-sm text-main placeholder:text-muted focus:outline-none focus:border-emerald-400"
          placeholder={t.search || "Search papers..."}
          value={q}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          {loading ? <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
           : papers.length === 0 ? <EmptyState icon={Bookmark} title={t.noPapers} hint={t.noPapersHint} />
           : papers.map((paper) => (
            <div key={paper._id || paper.title} className="surface-hover cursor-pointer group" onClick={() => onSelectPaper?.(paper._id || paper.title)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onSelectPaper?.(paper._id || paper.title); }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-main line-clamp-2 leading-snug">{paper.title}</h3>
                  <p className="text-xs text-muted mt-1">{paper.area} &middot; {paper.source}</p>
                  {paper.abstract && <p className="text-xs text-muted mt-2 line-clamp-2 leading-relaxed">{paper.abstract}</p>}
                  {paper.doi && (
                    <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"><ExternalLink className="h-3 w-3" />{paper.doi}</a>
                  )}
                  <div className="flex flex-wrap gap-1 mt-3">{(paper.tags||[]).map((tag) => (<span key={tag} className="badge">{tag}</span>))}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{paper.score}</span>
                  <span className="badge">{sharingLabel(t, paper.sharing)}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-all"
                    onClick={(e) => { e.stopPropagation(); handleDelete(paper._id || paper.title); }}
                    disabled={deleting === (paper._id || paper.title)}
                  >
                    {deleting === (paper._id || paper.title) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted">{page} / {pagination.totalPages}</span>
              <button onClick={() => goToPage(page + 1)} disabled={!pagination.hasMore} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
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
    </div>
  );
}
