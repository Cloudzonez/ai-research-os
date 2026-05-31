import React, { useState, useRef, useEffect } from "react";
import { ArrowRight, Layers3, Bot, CheckCircle2, Route, BookOpen, ChevronDown, ChevronUp, FileText, ExternalLink, Plus, Loader2, Search, Pencil, Check, X } from "lucide-react";
import routeTemplates from "../data/routeTemplates.js";
import { api } from "../utils/api.js";

function formatTokens(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** Clean up text artifacts from streaming — fix smart quote spacing, etc. */
function cleanDisplayText(text) {
  if (!text) return text;
  return text
    // Fix spaces around smart apostrophes: "I' ve" → "I've", "you' d" → "you'd"
    .replace(/(\w)\s+['\u2018\u2019]\s+(\w)/g, "$1'$2")
    // Fix space before smart apostrophe: "I 've" → "I've"
    .replace(/(\w)\s+['\u2018\u2019](\w)/g, "$1'$2")
    // Fix space after smart apostrophe: "I' ve" → "I've"
    .replace(/(\w)['\u2018\u2019]\s+(\w)/g, "$1'$2")
    // Normalize remaining smart quotes to regular apostrophes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function PaperResultCard({ paper, locale, addToast }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isZh = locale === "zh";

  async function handleSave() {
    setSaving(true);
    try {
      const result = await api.savePaper(paper);
      setSaved(true);
      if (result.duplicate) {
        addToast?.(isZh ? "论文已在文库中" : "Already in library", "info");
      } else {
        addToast?.(isZh ? "已添加到文库" : "Added to library", "success");
      }
    } catch (err) {
      addToast?.(err.message || (isZh ? "保存失败" : "Save failed"), "error");
    } finally {
      setSaving(false);
    }
  }

  function openPdf(url) {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="surface-inset p-3 rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-medium text-main line-clamp-2 leading-snug">{paper.title}</h4>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-[11px] text-muted">
            {paper.authors?.length > 0 && (
              <span>{paper.authors.slice(0, 3).join(", ")}{paper.authors.length > 3 ? " et al." : ""}</span>
            )}
            {paper.year && <span>· {paper.year}</span>}
            {paper.journal && <span>· {paper.journal}</span>}
            {paper.citedByCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                · {isZh ? `引用 ${paper.citedByCount}` : `${paper.citedByCount} citations`}
              </span>
            )}
          </div>
          {paper.abstract && (
            <p className="text-[11px] text-muted mt-1.5 line-clamp-2 leading-relaxed">{paper.abstract}</p>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {paper.pdfUrl ? (
            <button
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
              onClick={() => openPdf(paper.pdfUrl)}
              title={isZh ? "在新标签页打开 PDF" : "Open PDF in new tab"}
            >
              <FileText className="h-3 w-3" />
              PDF
            </button>
          ) : paper.url ? (
            <button
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-white/5 text-muted hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              onClick={() => openPdf(paper.url)}
              title={isZh ? "查看原文" : "View source"}
            >
              <ExternalLink className="h-3 w-3" />
              {isZh ? "原文" : "View"}
            </button>
          ) : null}
          <button
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            onClick={handleSave}
            disabled={saving || saved}
            title={isZh ? "添加到文库" : "Add to library"}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <CheckCircle2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {saved ? (isZh ? "已收藏" : "Saved") : (isZh ? "收藏" : "Save")}
          </button>
          {paper.isOpenAccess && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium text-center">
              OA
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessageCard({ message, t, locale, setActiveView, papers = [], addToast, messageIndex, onEditAndResubmit }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // Auto-expand searched papers section when papers exist
  const searchedPapersExist = (message.searchedPapers || []).length > 0;
  const [papersExpanded, setPapersExpanded] = useState(searchedPapersExist);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const editRef = useRef(null);
  const isZh = locale === "zh";

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.style.height = "auto";
      editRef.current.style.height = editRef.current.scrollHeight + "px";
    }
  }, [editing]);

  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-4 animate-fade-in group">
        {editing ? (
          <div className="max-w-[75%] w-full space-y-2">
            <textarea
              ref={editRef}
              className="w-full rounded-2xl rounded-br-md bg-emerald-600 text-white px-4 py-3 text-sm leading-relaxed resize-none outline-none ring-2 ring-emerald-400"
              value={editText}
              onChange={(e) => {
                setEditText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const trimmed = editText.trim();
                  if (trimmed && onEditAndResubmit) {
                    onEditAndResubmit(messageIndex, trimmed);
                    setEditing(false);
                  }
                }
                if (e.key === "Escape") { setEditing(false); setEditText(message.text); }
              }}
            />
            <div className="flex justify-end gap-1.5">
              <button
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-200 dark:bg-white/10 text-dull hover:bg-gray-300 dark:hover:bg-white/20 transition-colors"
                onClick={() => { setEditing(false); setEditText(message.text); }}
              >
                <X className="h-3 w-3" /> {isZh ? "取消" : "Cancel"}
              </button>
              <button
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                disabled={!editText.trim()}
                onClick={() => {
                  const trimmed = editText.trim();
                  if (trimmed && onEditAndResubmit) {
                    onEditAndResubmit(messageIndex, trimmed);
                    setEditing(false);
                  }
                }}
              >
                <Check className="h-3 w-3" /> {isZh ? "提交并重新生成" : "Submit & regenerate"}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative max-w-[75%]">
            <div className="rounded-2xl rounded-br-md bg-emerald-600 text-white px-4 py-3">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
            </div>
            {onEditAndResubmit && (
              <button
                className="absolute -left-8 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-0 group-hover:opacity-70 hover:!opacity-100 bg-gray-200 dark:bg-white/10 text-dull hover:text-main transition-all"
                onClick={() => { setEditing(true); setEditText(message.text); }}
                title={isZh ? "编辑并重新生成" : "Edit & regenerate"}
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const route = routeTemplates[message.kind] || routeTemplates.general;
  const steps = route.steps?.[locale] || [];

  // Use real context bundle data from the message
  const ctx = message.contextBundle || {};
  const ctxTokens = ctx.tokens || 0;
  const ctxArtifacts = ctx.artifacts || 0;
  const ctxAllowed = ctx.allowedPercent ?? 100;
  const ctxPapers = ctx.papers?.length ? ctx.papers : papers;
  const ctxSource = ctx.source;

  // Searched papers from OpenAlex
  const searchedPapers = message.searchedPapers || [];

  return (
    <div className="mb-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <p className="text-sm leading-relaxed text-dull whitespace-pre-wrap">{cleanDisplayText(message.text)}</p>

          {/* ═══ Searched Papers from OpenAlex ═══ */}
          {searchedPapers.length > 0 && (
            <div className="surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] font-medium text-main">
                  <Search className="h-4 w-4 text-blue-500" />
                  {isZh ? `找到 ${searchedPapers.length} 篇相关论文` : `Found ${searchedPapers.length} related papers`}
                </div>
                <button
                  className="text-[11px] text-muted hover:text-dull transition-colors flex items-center gap-0.5"
                  onClick={() => setPapersExpanded(!papersExpanded)}
                >
                  {papersExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {papersExpanded ? (isZh ? "收起" : "Collapse") : (isZh ? "展开" : "Expand")}
                </button>
              </div>
              {papersExpanded && (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {searchedPapers.map((paper, i) => (
                    <PaperResultCard
                      key={paper.doi || paper.title || i}
                      paper={paper}
                      locale={locale}
                      addToast={addToast}
                    />
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted text-center">
                {isZh ? "数据来源: OpenAlex · 点击 PDF 在新标签页打开" : "Source: OpenAlex · Click PDF to open in new tab"}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
