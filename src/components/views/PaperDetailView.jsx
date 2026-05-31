import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, ZoomIn, ZoomOut, ExternalLink, FileText, Loader2, Maximize2, Minimize2, MessageSquare, Sparkles, Languages } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { api } from "../../utils/api.js";
import { sharingLabel } from "../../utils/sharingLabel.js";
import PaperChat from "../PaperChat.jsx";
import { ErrorDisplay, Skeleton } from "../LoadingStates.jsx";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

function getPdfUrl(paper) {
  if (paper.pdfPath) return `/uploads/${paper.pdfPath.split("/").pop()}`;
  if (paper.url && paper.url.toLowerCase().endsWith(".pdf")) return paper.url;
  return null;
}

export default function PaperDetailView({ t, paperId, setActiveView, locale, addToast }) {
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.3);
  const [isExpanded, setIsExpanded] = useState(false);

  // Text selection state
  const [selectedText, setSelectedText] = useState("");
  const [selectionMenu, setSelectionMenu] = useState(null); // { x, y } or null
  const [contextMenu, setContextMenu] = useState(null); // { x, y } or null
  const pdfContainerRef = useRef(null);

  const isZh = locale === "zh";

  useEffect(() => {
    if (!paperId) return;
    setLoading(true);
    setError(null);
    api.fetchPaper(paperId)
      .then((data) => setPaper(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [paperId]);

  const onDocumentLoadSuccess = useCallback(({ numPages: nextNumPages }) => {
    setNumPages(nextNumPages);
  }, []);

  // ── Text selection detection ──
  function handleMouseUp(e) {
    // Small delay to let the browser finalize the selection
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text || text.length < 3) {
        setSelectedText("");
        setSelectionMenu(null);
        return;
      }
      // Only react to selections within the PDF container
      const container = pdfContainerRef.current;
      if (!container) return;
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) return;

      setSelectedText(text);
      const rect = range.getBoundingClientRect();
      setSelectionMenu({
        x: rect.left + rect.width / 2,
        y: rect.top - 12,
      });
      setContextMenu(null);
    }, 10);
  }

  function handleContextMenu(e) {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 3) return;
    const container = pdfContainerRef.current;
    if (!container) return;
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return;

    e.preventDefault();
    setSelectedText(text);
    setContextMenu({ x: e.clientX, y: e.clientY });
    setSelectionMenu(null);
  }

  function dismissMenus() {
    setSelectionMenu(null);
    setContextMenu(null);
  }

  // ── Actions on selected text ──
  const [pendingQuote, setPendingQuote] = useState("");

  function askAboutSelection() {
    setPendingQuote(selectedText);
    dismissMenus();
    // If expanded, collapse to show chat
    if (isExpanded) setIsExpanded(false);
  }

  function explainSelection() {
    const prompt = isZh
      ? `请解释以下段落：\n\n"${selectedText}"`
      : `Please explain this passage:\n\n"${selectedText}"`;
    setPendingQuote(prompt);
    dismissMenus();
    if (isExpanded) setIsExpanded(false);
  }

  function summarizeSelection() {
    const prompt = isZh
      ? `请总结以下段落：\n\n"${selectedText}"`
      : `Please summarize this passage:\n\n"${selectedText}"`;
    setPendingQuote(prompt);
    dismissMenus();
    if (isExpanded) setIsExpanded(false);
  }

  // ── Dismiss menus on outside click ──
  useEffect(() => {
    function onClick() { dismissMenus(); }
    if (selectionMenu || contextMenu) {
      document.addEventListener("click", onClick);
      return () => document.removeEventListener("click", onClick);
    }
  }, [selectionMenu, contextMenu]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton lines={1} />
        <div className="flex gap-4" style={{ height: "70vh" }}>
          <div className="flex-1 surface animate-pulse rounded-xl" />
          <div className="w-[400px] surface animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) return <ErrorDisplay message={error} />;
  if (!paper) return <ErrorDisplay message={isZh ? "未找到论文" : "Paper not found"} />;

  const pdfUrl = getPdfUrl(paper);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-200 dark:border-white/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <button className="btn-icon shrink-0 mt-0.5" onClick={() => setActiveView("library")}
            aria-label={isZh ? "返回文库" : "Back to library"}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-main line-clamp-2 leading-snug">{paper.title}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              {paper.authors?.length > 0 && <span className="text-xs text-muted">{paper.authors.slice(0, 5).join(", ")}{paper.authors.length > 5 ? " et al." : ""}</span>}
              {paper.year && <span className="text-xs text-muted">{paper.year}</span>}
              <span className="text-xs text-muted">{paper.source}</span>
              <span className="badge text-[10px]">{sharingLabel(t, paper.sharing)}</span>
              {paper.doi && (
                <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  <ExternalLink className="h-3 w-3" />{paper.doi}
                </a>
              )}
            </div>
          </div>
          {/* Expand / collapse toggle */}
          <button
            className="btn-icon shrink-0"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? (isZh ? "显示对话" : "Show chat") : (isZh ? "放大阅读" : "Expand reader")}
            title={isExpanded ? (isZh ? "显示对话面板" : "Show chat panel") : (isZh ? "放大阅读区" : "Expand reader")}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main content: PDF left, Chat right */}
      <div className="flex-1 flex min-h-0">
        {/* PDF panel */}
        <div className={`${isExpanded ? "flex-1" : "flex-1"} min-w-0 flex flex-col bg-zinc-100 dark:bg-zinc-900 relative`}>
          {pdfUrl ? (
            <>
              {/* PDF zoom controls */}
              <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-2 bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-white/5">
                <button className="btn-icon" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))} disabled={scale <= 0.5}
                  aria-label={isZh ? "缩小" : "Zoom out"}>
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-[11px] text-muted tabular-nums w-10 text-center">{Math.round(scale * 100)}%</span>
                <button className="btn-icon" onClick={() => setScale((s) => Math.min(3, s + 0.2))} disabled={scale >= 3}
                  aria-label={isZh ? "放大" : "Zoom in"}>
                  <ZoomIn className="h-4 w-4" />
                </button>
                {numPages && (
                  <>
                    <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1" />
                    <span className="text-[11px] text-muted">{numPages} {isZh ? "页" : "pages"}</span>
                  </>
                )}
              </div>

              {/* Continuous scroll PDF */}
              <div
                ref={pdfContainerRef}
                className="flex-1 overflow-auto flex flex-col items-center p-4 gap-3"
                onMouseUp={handleMouseUp}
                onContextMenu={handleContextMenu}
              >
                <Document
                  file={pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex items-center gap-2 text-muted py-20">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">{isZh ? "加载 PDF..." : "Loading PDF..."}</span>
                    </div>
                  }
                  error={
                    <div className="flex flex-col items-center gap-2 text-muted py-20">
                      <FileText className="h-8 w-8" />
                      <span className="text-sm">{isZh ? "PDF 加载失败" : "Failed to load PDF"}</span>
                    </div>
                  }
                >
                  {Array.from({ length: numPages || 0 }, (_, i) => (
                    <Page
                      key={`page_${i + 1}`}
                      pageNumber={i + 1}
                      scale={scale}
                      renderTextLayer
                      renderAnnotationLayer
                      className="shadow-lg"
                    />
                  ))}
                </Document>
              </div>

              {/* Floating selection menu */}
              {selectionMenu && (
                <div
                  className="fixed z-50 flex items-center gap-0.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl px-1.5 py-1"
                  style={{ left: selectionMenu.x, top: selectionMenu.y, transform: "translate(-50%, -100%)" }}
                  onMouseDown={(e) => e.preventDefault()} // prevent losing selection
                >
                  <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-dull hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    onClick={askAboutSelection}>
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                    {isZh ? "对话" : "Chat"}
                  </button>
                  <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-dull hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    onClick={explainSelection}>
                    <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                    {isZh ? "解释" : "Explain"}
                  </button>
                  <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-dull hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    onClick={summarizeSelection}>
                    <Languages className="h-3.5 w-3.5 text-purple-500" />
                    {isZh ? "总结" : "Summarize"}
                  </button>
                </div>
              )}

              {/* Right-click context menu */}
              {contextMenu && (
                <div
                  className="fixed z-50 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-xl py-1 min-w-[180px]"
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="px-3 py-1.5 text-[10px] text-muted uppercase tracking-wider">
                    {selectedText.length > 60 ? selectedText.slice(0, 60) + "..." : selectedText}
                  </div>
                  <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-dull hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    onClick={askAboutSelection}>
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                    {isZh ? "就此段对话" : "Chat about this"}
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-dull hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    onClick={explainSelection}>
                    <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                    {isZh ? "解释此段" : "Explain this passage"}
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-dull hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    onClick={summarizeSelection}>
                    <Languages className="h-3.5 w-3.5 text-purple-500" />
                    {isZh ? "总结此段" : "Summarize this passage"}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* No PDF available */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <FileText className="h-12 w-12 text-muted mb-4" />
              <p className="text-sm font-medium text-dull">{isZh ? "无可预览的 PDF" : "No PDF preview available"}</p>
              <p className="text-xs text-muted mt-1 max-w-xs">
                {paper.url
                  ? (isZh ? "此论文来自外部链接，点击下方查看原文" : "This paper is from an external link. View the source below.")
                  : (isZh ? "此论文尚未上传 PDF 文件" : "No PDF file has been uploaded for this paper.")}
              </p>
              {paper.url && (
                <a href={paper.url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 inline-flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  {isZh ? "查看原文" : "View source"}
                </a>
              )}
              {paper.abstract && (
                <div className="surface mt-6 p-4 max-w-lg text-left">
                  <h4 className="text-xs font-semibold text-main mb-2">{isZh ? "摘要" : "Abstract"}</h4>
                  <p className="text-xs text-dull leading-relaxed">{paper.abstract}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat panel — hidden when expanded */}
        {!isExpanded && (
          <div className="shrink-0 w-[400px] border-l border-gray-200 dark:border-white/5 flex flex-col bg-white dark:bg-zinc-950">
            <div className="shrink-0 px-4 py-2.5 border-b border-gray-200 dark:border-white/5">
              <h3 className="text-xs font-semibold text-main">{isZh ? "论文对话" : "Paper Chat"}</h3>
              <p className="text-[11px] text-muted mt-0.5">{isZh ? "选中 PDF 文字即可快速提问" : "Select text in the PDF to quickly ask about it"}</p>
            </div>
            <div className="flex-1 min-h-0">
              <PaperChat t={t} locale={locale} paperId={paperId} addToast={addToast} presetMessage={pendingQuote} onConsumed={() => setPendingQuote("")} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
