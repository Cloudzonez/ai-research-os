import React, { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Share2, Bookmark, ExternalLink, Search, ArrowUpDown, Edit3, Trash2, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { CardSkeleton, EmptyState, ErrorDisplay } from "../LoadingStates.jsx";
import { sharingLabel } from "../../utils/sharingLabel.js";
import { api } from "../../utils/api.js";

export default function LibraryView({ t, user, papers: initialPapers, onUpload, onSelectPaper, isLoading: initialLoading, error, refreshPapers }) {
  const [papers, setPapers] = useState(initialPapers);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const searchTimer = useRef(null);

  const fetchPapers = useCallback(async (p, query, sortBy) => {
    setLoading(true);
    try {
      const res = await api.fetchPapers({ page: p || page, q: query ?? q, sort: sortBy ?? sort, limit: 20 });
      setPapers(res.papers);
      setPagination(res.pagination);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, q, sort]);

  // Debounced search
  const handleSearch = (val) => {
    setQ(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchPapers(1, val, sort);
    }, 400);
  };

  const handleSort = (val) => {
    setSort(val);
    setPage(1);
    fetchPapers(1, q, val);
  };

  const goToPage = (p) => {
    setPage(p);
    fetchPapers(p, q, sort);
  };

  // Sync from parent when initialPapers changes
  useEffect(() => { setPapers(initialPapers); }, [initialPapers]);

  // Initial fetch with pagination
  useEffect(() => {
    fetchPapers(1, "", "createdAt");
  }, []);

  const handleUploadWithProgress = async (files) => {
    if (!files?.length) return;
    setUploadProgress(0);
    try {
      await onUpload(files);
      setUploadProgress(null);
      fetchPapers(1, q, sort);
    } catch {
      setUploadProgress(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await api.deletePaper(id);
      setPapers((c) => c.filter((p) => p._id !== id));
      fetchPapers(page > 1 && papers.length <= 1 ? page - 1 : page, q, sort);
    } catch { /* ignore */ }
  };

  const startEdit = (paper) => {
    setEditingId(paper._id);
    setEditForm({ title: paper.title, abstract: paper.abstract || "", doi: paper.doi || "", year: paper.year || "", tags: (paper.tags || []).join(", ") });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      const updated = await api.updatePaper(id, {
        ...editForm,
        tags: editForm.tags.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setPapers((c) => c.map((p) => (p._id === id ? updated : p)));
      setEditingId(null);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  if (error) return <ErrorDisplay message={error} />;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-lg font-semibold text-main">{t.library}</h2><p className="text-sm text-muted mt-0.5">{t.sourceMemory}</p></div>
        <span className="text-xs text-muted">{pagination ? `${pagination.total} papers` : `${papers.length} papers`}</span>
      </div>

      {/* Search + Sort bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder={t.search}
            value={q}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {q && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-main" onClick={() => { setQ(""); setPage(1); fetchPapers(1, "", sort); }}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted" />
          <select
            className="text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-2 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={sort}
            onChange={(e) => handleSort(e.target.value)}
          >
            <option value="createdAt">{t.sortCreatedAt}</option>
            <option value="year">{t.sortYear}</option>
            <option value="score">{t.sortScore}</option>
            <option value="relevance">{t.sortRelevance}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          {loading ? (
            <>
              <CardSkeleton /><CardSkeleton /><CardSkeleton />
            </>
          ) : papers.length === 0 ? (
            <EmptyState icon={q ? Search : Bookmark} title={q ? t.noResults : t.noPapers} hint={q ? "" : t.noPapersHint} />
          ) : papers.map((paper) => (
            <div key={paper._id || paper.title} className="surface-hover group relative">
              {editingId === paper._id ? (
                <div className="p-4 space-y-3">
                  <input className="w-full text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" />
                  <textarea className="w-full text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2" rows={3} value={editForm.abstract} onChange={(e) => setEditForm((f) => ({ ...f, abstract: e.target.value }))} placeholder="Abstract" />
                  <div className="flex gap-2">
                    <input className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2" value={editForm.doi} onChange={(e) => setEditForm((f) => ({ ...f, doi: e.target.value }))} placeholder="DOI" />
                    <input className="w-24 text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2" type="number" value={editForm.year} onChange={(e) => setEditForm((f) => ({ ...f, year: parseInt(e.target.value) || "" }))} placeholder="Year" />
                  </div>
                  <input className="w-full text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2" value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} placeholder="Tags (comma separated)" />
                  <div className="flex gap-2 justify-end">
                    <button className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-zinc-800" onClick={cancelEdit}>{t.cancel}</button>
                    <button className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50" onClick={() => saveEdit(paper._id)} disabled={saving}>{saving ? t.saving : t.save}</button>
                  </div>
                </div>
              ) : (
                <div className="cursor-pointer" onClick={() => onSelectPaper?.(paper._id || paper.title)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onSelectPaper?.(paper._id || paper.title); }}>
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-main line-clamp-2 leading-snug">{paper.title}</h3>
                      <p className="text-xs text-muted mt-1">{paper.area} &middot; {paper.source}</p>
                      {paper.abstract && <p className="text-xs text-muted mt-2 line-clamp-2 leading-relaxed">{paper.abstract}</p>}
                      {paper.doi && (
                        <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-3 w-3" />{paper.doi}</a>
                      )}
                      <div className="flex flex-wrap gap-1 mt-3">{(paper.tags||[]).map((tag) => (<span key={tag} className="badge">{tag}</span>))}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{paper.score}</span>
                      <span className="badge">{sharingLabel(t, paper.sharing)}</span>
                      {paper.year && <span className="text-[11px] text-muted">{paper.year}</span>}
                    </div>
                  </div>
                  {/* Edit/Delete actions */}
                  {user && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-muted hover:text-main" onClick={(e) => { e.stopPropagation(); startEdit(paper); }} title={t.edit}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(paper._id); }} title={t.delete}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 pb-2">
              <button
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />{t.prev}
              </button>
              <span className="text-xs text-muted px-2">
                {t.page} {page}/{pagination.totalPages}
              </span>
              <button
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-30"
                disabled={page >= pagination.totalPages}
                onClick={() => goToPage(page + 1)}
              >
                {t.next}<ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-3">
          {/* Upload area */}
          <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-white/10 p-8 text-center cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/[0.03] transition-all relative">
            {uploadProgress !== null ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
                <span className="text-sm text-muted">{t.uploading}</span>
                <div className="w-32 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.round(uploadProgress * 100)}%` }} />
                </div>
                <span className="text-xs text-muted">{Math.round(uploadProgress * 100)}%</span>
              </div>
            ) : (
              <>
                <Upload className="h-6 w-6 text-muted mb-2" />
                <span className="text-sm font-medium text-dull">{t.uploadPdf}</span>
                <span className="text-xs text-muted mt-1">{t.pdfQueue}</span>
              </>
            )}
            <input className="hidden" type="file" accept="application/pdf" multiple disabled={uploadProgress !== null} onChange={(e) => handleUploadWithProgress(e.target.files)} />
          </label>

          {/* Sharing policy card */}
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
