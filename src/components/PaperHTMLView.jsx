import { useState, useEffect } from "react";
import { Loader2, ExternalLink, AlertCircle, Maximize2, Minimize2 } from "lucide-react";
import api from "../utils/api.js";

// Fullscreen HTML paper view — renders the AI-generated HTML page
// for a paper in an iframe, with toolbar controls.
export default function PaperHTMLView({ paperId, paper, t, locale, onClose }) {
  const [html, setHtml] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!paperId) return;
    setLoading(true);
    setError(null);
    api.getPaperHTML(paperId, locale)
      .then((content) => {
        setHtml(content);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [paperId, locale]);

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 bg-background flex flex-col"
    : "flex flex-col h-full min-h-[60vh]";

  return (
    <div className={containerClass}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← {t.backToLibrary || "Back"}
            </button>
          )}
          <h2 className="text-sm font-medium truncate max-w-md">
            {paper?.title || t.paperDetail || "Paper"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {fullscreen ? (t.exitFullscreen || "Exit fullscreen") : (t.fullscreen || "Fullscreen")}
          </button>
          {paper?.url && (
            <a
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
            >
              <ExternalLink size={14} />
              {t.openArxiv || "arXiv"}
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="text-center">
              <Loader2 size={32} className="animate-spin mx-auto text-indigo-500 mb-3" />
              <p className="text-sm text-muted-foreground">{t.generatingHTML || "Loading..."}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="text-center max-w-md">
              <AlertCircle size={48} className="mx-auto text-amber-500 mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">{t.pdfLoadFailed || "Failed to load"}</p>
              <p className="text-xs text-muted-foreground mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  api.getPaperHTML(paperId, locale)
                    .then(setHtml)
                    .catch((err) => setError(err.message))
                    .finally(() => setLoading(false));
                }}
                className="text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {t.retry || "Retry"}
              </button>
            </div>
          </div>
        )}

        {html && !loading && (
          <iframe
            srcDoc={html}
            className="w-full h-full border-0"
            style={{ minHeight: fullscreen ? "100vh" : "60vh" }}
            sandbox="allow-scripts allow-same-origin"
            title={paper?.title || "Paper HTML view"}
          />
        )}
      </div>
    </div>
  );
}
