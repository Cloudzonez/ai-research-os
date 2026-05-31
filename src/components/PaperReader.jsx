import { useState } from "react";
import {
  FileText, ChevronDown, ChevronUp, Sparkles, ExternalLink,
  BookOpen, MessageCircle, FileDown, X, Loader2,
} from "lucide-react";
import api from "../utils/api.js";
import { cn } from "../utils/cn.js";
import Markdown from "./Markdown.jsx";

// Card for a single paper with TL;DR always visible.
// Absorbed from Daily-arXiv's paper card + detail modal UX pattern.
export function PaperCard({ paper, t, locale, onSelect, onAnalyzeInChat }) {
  const [expanded, setExpanded] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const hasAI = paper.aiSummary?.tldr;
  const hasHTML = paper.htmlPage || paper.htmlGeneratedAt;

  const handleSummarize = async (e) => {
    e.stopPropagation();
    setSummarizing(true);
    try {
      await api.summarizePaper(paper._id, locale);
      // The parent should refresh the paper list, but for now
      // we optimistically update the paper object
      setSummarizing(false);
    } catch {
      setSummarizing(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 cursor-pointer transition-all hover:shadow-md",
        expanded && "ring-2 ring-purple-200"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex-1">
          {paper.title}
        </h3>
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {paper.source}
        </span>
      </div>

      {/* Authors */}
      {paper.authors?.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {paper.authors.slice(0, 3).join(", ")}
          {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
        </p>
      )}

      {/* TL;DR — always visible (Daily-arXiv pattern) */}
      {hasAI ? (
        <div className="mt-2 rounded-md bg-gradient-to-r from-indigo-50 to-purple-50 p-2.5 border-l-2 border-indigo-400">
          <p className="text-xs font-medium text-indigo-600 mb-0.5">{t.tldr}</p>
          <div className="text-xs text-slate-700 leading-relaxed line-clamp-3">
            <Markdown>{paper.aiSummary.tldr}</Markdown>
          </div>
        </div>
      ) : (
        <div className="mt-2 rounded-md bg-muted/50 p-2.5">
          <div className="text-xs text-muted-foreground line-clamp-2">
            <Markdown>{paper.abstract || paper.summary || t.noAISummary}</Markdown>
          </div>
        </div>
      )}

      {/* Tags */}
      {paper.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {paper.tags.slice(0, 5).map((tag, i) => (
            <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Expand indicator */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? t.collapse || "收起" : t.expand || "展开"}
          </button>
        </div>
        <div className="flex gap-1">
          {!hasAI && !summarizing && (
            <button
              onClick={handleSummarize}
              className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
            >
              <Sparkles size={12} />
              {t.summarizePaper}
            </button>
          )}
          {summarizing && (
            <span className="text-xs flex items-center gap-1 px-2 py-1 text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              {t.summarizing}
            </span>
          )}
        </div>
      </div>

      {/* Expanded detail section */}
      {expanded && (
        <PaperDetail
          paper={paper}
          t={t}
          locale={locale}
          hasAI={hasAI}
          hasHTML={hasHTML}
          onSummarize={handleSummarize}
          summarizing={summarizing}
          onAnalyzeInChat={onAnalyzeInChat}
        />
      )}
    </div>
  );
}

// Collapsible detail section — shown when card is expanded
function PaperDetail({ paper, t, locale, hasAI, hasHTML, onSummarize, summarizing, onAnalyzeInChat }) {
  const [showHTML, setShowHTML] = useState(false);
  const [htmlContent, setHtmlContent] = useState(null);

  const loadHTML = async () => {
    if (htmlContent) {
      setShowHTML(!showHTML);
      return;
    }
    try {
      const html = await api.getPaperHTML(paper._id, locale);
      setHtmlContent(html);
      setShowHTML(true);
    } catch (err) {
      console.error("Failed to load HTML:", err);
    }
  };

  const ai = paper.aiSummary || {};

  if (showHTML && htmlContent) {
    return (
      <div className="mt-3 relative">
        <button
          onClick={() => setShowHTML(false)}
          className="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
        >
          <X size={14} /> {t.collapse || "收起"}
        </button>
        <iframe
          srcDoc={htmlContent}
          className="w-full rounded border"
          style={{ height: "70vh", minHeight: "400px" }}
          sandbox="allow-scripts"
          title={paper.title}
        />
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {/* AI Analysis sections (Daily-arXiv's collapsible details pattern) */}
      {hasAI ? (
        <div className="space-y-2.5">
          <Section label={t.motivation} content={ai.motivation} />
          <Section label={t.method} content={ai.method} />
          <Section label={t.result} content={ai.result} />
          <Section label={t.conclusion} content={ai.conclusion} />
        </div>
      ) : (
        <div className="text-center py-4">
          <Sparkles size={24} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{t.noAISummary}</p>
          <p className="text-xs text-muted-foreground">{t.noAISummaryHint}</p>
          {!summarizing && (
            <button
              onClick={(e) => { e.stopPropagation(); onSummarize?.(e); }}
              className="mt-2 text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-1.5"
            >
              <Sparkles size={14} /> {t.summarizePaper}
            </button>
          )}
        </div>
      )}

      {/* Original abstract (Daily-arXiv's collapsible abstract pattern) */}
      {(paper.abstract || paper.summary) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-indigo-600 font-medium hover:text-indigo-700">
            {t.originalAbstract}
          </summary>
          <p className="mt-1.5 text-muted-foreground leading-relaxed italic">
            {paper.abstract || paper.summary}
          </p>
        </details>
      )}

      {/* Action buttons (Daily-arXiv's footer links pattern) */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
        {/* AI-generated HTML page */}
        <button
          onClick={(e) => { e.stopPropagation(); loadHTML(); }}
          className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-purple-50 text-purple-600 hover:bg-purple-100"
        >
          <BookOpen size={14} />
          {t.viewHTML}
        </button>

        {/* Analyze in chat */}
        {onAnalyzeInChat && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAnalyzeInChat(paper);
            }}
            className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
          >
            <MessageCircle size={14} />
            {t.analyzeInChat}
          </button>
        )}

        {/* PDF link */}
        {paper.pdfUrl && (
          <a
            href={paper.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-muted text-muted-foreground hover:bg-muted/80"
          >
            <FileDown size={14} />
            {t.openPDF}
          </a>
        )}

        {/* arXiv link */}
        {paper.url && (
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-muted text-muted-foreground hover:bg-muted/80"
          >
            <ExternalLink size={14} />
            {t.openArxiv}
          </a>
        )}

        {/* DOI */}
        {paper.doi && (
          <span className="text-[10px] text-muted-foreground self-center ml-auto">
            DOI: {paper.doi}
          </span>
        )}
      </div>
    </div>
  );
}

function Section({ label, content }) {
  if (!content) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-600">{label}</h4>
      <Markdown className="text-xs text-slate-600">{content}</Markdown>
    </div>
  );
}

// Full paper detail modal (absorbed from Daily-arXiv's paper modal pattern)
export function PaperModal({ paper, t, locale, onClose, onAnalyzeInChat }) {
  const [htmlView, setHtmlView] = useState(false);
  const [htmlContent, setHtmlContent] = useState(null);

  const loadHTML = async () => {
    try {
      const html = await api.getPaperHTML(paper._id, locale);
      setHtmlContent(html);
      setHtmlView(true);
    } catch (err) {
      console.error("Failed to load HTML:", err);
    }
  };

  if (htmlView && htmlContent) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-background rounded-xl w-full max-w-4xl h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-3 border-b">
            <h2 className="font-semibold text-sm truncate">{paper.title}</h2>
            <div className="flex gap-2">
              <button onClick={() => setHtmlView(false)} className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">
                {t.collapse || "收起"}
              </button>
              <button onClick={onClose} className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">
                <X size={14} />
              </button>
            </div>
          </div>
          <iframe
            srcDoc={htmlContent}
            className="flex-1 w-full border-0"
            sandbox="allow-scripts"
            title={paper.title}
          />
        </div>
      </div>
    );
  }

  const ai = paper.aiSummary || {};

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4 flex items-start justify-between">
          <div className="flex-1 mr-4">
            <h2 className="font-semibold">{paper.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {(paper.authors || []).join(", ") || t.unknownAuthors || "Unknown authors"}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {(paper.tags || []).map((tag, i) => (
                <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* TL;DR card */}
          {ai.tldr && (
            <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 p-4 border-l-4 border-indigo-400">
              <p className="text-xs font-semibold text-indigo-600 mb-1">{t.tldr}</p>
              <div className="text-sm text-slate-800 leading-relaxed">
                <Markdown>{ai.tldr}</Markdown>
              </div>
            </div>
          )}

          {/* Structured analysis */}
          {(ai.motivation || ai.method || ai.result || ai.conclusion) && (
            <div className="space-y-3">
              <ModalSection label={t.motivation} icon="🎯" content={ai.motivation} />
              <ModalSection label={t.method} icon="🔧" content={ai.method} />
              <ModalSection label={t.result} icon="📊" content={ai.result} />
              <ModalSection label={t.conclusion} icon="💡" content={ai.conclusion} />
            </div>
          )}

          {/* Original abstract */}
          {(paper.abstract || paper.summary) && (
              <details className="text-sm">
                <summary className="cursor-pointer text-indigo-600 font-medium">{t.originalAbstract}</summary>
                <div className="mt-2 text-muted-foreground leading-relaxed italic">
                  <Markdown>{paper.abstract || paper.summary}</Markdown>
                </div>
              </details>
          )}

          {/* No AI analysis state */}
          {!ai.tldr && !ai.motivation && (
            <div className="text-center py-6">
              <Sparkles size={32} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">{t.noAISummary}</p>
              <p className="text-xs text-muted-foreground mb-3">{t.noAISummaryHint}</p>
              <button
                onClick={async () => {
                  try {
                    await api.summarizePaper(paper._id, locale);
                    window.location.reload();
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-2"
              >
                <Sparkles size={16} /> {t.summarizePaper}
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-background border-t p-3 flex flex-wrap gap-2">
          <button onClick={loadHTML} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100">
            <BookOpen size={14} /> {t.viewHTML}
          </button>
          {onAnalyzeInChat && (
            <button
              onClick={() => onAnalyzeInChat(paper)}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
            >
              <MessageCircle size={14} /> {t.analyzeInChat}
            </button>
          )}
          {paper.pdfUrl && (
            <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80"
            >
              <FileDown size={14} /> {t.openPDF}
            </a>
          )}
          {paper.url && (
            <a href={paper.url} target="_blank" rel="noopener noreferrer"
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80"
            >
              <ExternalLink size={14} /> {t.openArxiv}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalSection({ label, icon, content }) {
  if (!content) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-700">
        {icon && <span className="mr-1.5">{icon}</span>}
        {label}
      </h4>
      <Markdown className="text-sm text-slate-600">{content}</Markdown>
    </div>
  );
}
