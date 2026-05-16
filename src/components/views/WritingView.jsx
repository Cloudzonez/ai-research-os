import React, { useState } from "react";
import { PenLine, Network, FileText, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { EmptyState, ErrorDisplay } from "../LoadingStates.jsx";

export default function WritingView({ t, draft, setDraft, locale, onGenerateDraft, isLoading, error }) {
  const [outlineOpen, setOutlineOpen] = useState(true);
  const outline = locale === "zh"
    ? ["研究问题与教师真实场景","论文发现、阅读与追踪机制","任务上下文与校内科研记忆","写作支持与治理边界"]
    : ["Research problem and teacher scenarios","Discovery, reading, and tracking","Task context and institutional memory","Writing support and governance"];

  if (error) return <ErrorDisplay message={error} />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-lg font-semibold text-main">{t.writing}</h2><p className="text-sm text-muted mt-0.5">{t.generateDraft}</p></div>
        {draft && <span className="text-xs text-muted">{draft.length} chars &middot; {draft.split(/\n/).filter(Boolean).length} paras</span>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <div className="surface p-4 space-y-3">
          <button className="flex items-center justify-between w-full text-xs font-medium uppercase tracking-wider text-muted" onClick={() => setOutlineOpen(!outlineOpen)} type="button">
            <span className="flex items-center gap-2"><Network className="h-3.5 w-3.5" />{t.memoryGraph}</span>
            {outlineOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          {outlineOpen && (
            <div className="space-y-1">
              {outline.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px] text-dull py-1.5 px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                  <span className="text-[11px] font-medium text-muted mt-px">{i+1}.</span><span>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="surface p-5 min-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted" /><h3 className="text-sm font-semibold text-main">{t.writingDraft}</h3></div>
            <button className="btn-primary h-8 text-xs" type="button" onClick={onGenerateDraft} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}{t.generateDraft}
            </button>
          </div>
          {draft ? (
            <textarea className="w-full resize-none rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/5 px-4 py-4 text-sm text-dull leading-relaxed placeholder:text-muted outline-none focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/10 transition-all" style={{minHeight:"380px"}} value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <EmptyState icon={PenLine} title={t.noDraft} hint={t.noDraftHint} />
          )}
        </div>
      </div>
    </div>
  );
}
