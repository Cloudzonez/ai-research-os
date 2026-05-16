import React from "react";
import { Upload, Share2, Bookmark, ExternalLink } from "lucide-react";
import { CardSkeleton, EmptyState, ErrorDisplay } from "../LoadingStates.jsx";
import { sharingLabel } from "../../utils/sharingLabel.js";

export default function LibraryView({ t, papers, onUpload, onSelectPaper, isLoading, error }) {
  if (error) return <ErrorDisplay message={error} />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-lg font-semibold text-main">{t.library}</h2><p className="text-sm text-muted mt-0.5">{t.sourceMemory}</p></div>
        <span className="text-xs text-muted">{papers.length} papers</span>
      </div>

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
                    <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"><ExternalLink className="h-3 w-3" />{paper.doi}</a>
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
    </div>
  );
}
