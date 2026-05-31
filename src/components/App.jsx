import React, { useState, useEffect, useCallback, useMemo, useTransition } from "react";
import copy from "../i18n/index.js";
import { api } from "../utils/api.js";
import { cn } from "../utils/cn.js";
import ToastProvider, { useToast } from "./Toast.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import Header from "./Header.jsx";
import Navigation from "./Navigation.jsx";
import ContextPanel from "./ContextPanel.jsx";
import Login from "./Login.jsx";
import AiCenter from "./views/AiCenter.jsx";
import TrackersView from "./views/TrackersView.jsx";
import LibraryView from "./views/LibraryView.jsx";
import WritingView from "./views/WritingView.jsx";
import GovernanceView from "./views/GovernanceView.jsx";
import FoundryView from "./views/FoundryView.jsx";
import DashboardsView from "./views/DashboardsView.jsx";
import PaperDetailView from "./views/PaperDetailView.jsx";

const VIEWS = { ai: AiCenter, trackers: TrackersView, library: LibraryView, writing: WritingView, governance: GovernanceView, dashboards: DashboardsView, foundry: FoundryView, paperDetail: PaperDetailView };

function AppContent() {
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [locale, setLocale] = useState(() => localStorage.getItem("locale") || "zh");
  const [activeView, setActiveView] = useState("ai");
  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [papers, setPapers] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [health, setHealth] = useState(null);
  const [tokenUsage, setTokenUsage] = useState(null);

  // Auth state
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [isLoading, setIsLoading] = useState({ app: true, messages: false, upload: false, draft: false, trackers: false });
  const [errors, setErrors] = useState({ trackers: null, papers: null, writing: null, messages: null });

  const t = useMemo(() => copy[locale], [locale]);

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  function toggleTheme() { setTheme((t) => (t === "light" ? "dark" : "light")); }

  // Auth check on mount
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setAuthChecked(true);
      setIsLoading((p) => ({ ...p, app: false }));
      return;
    }
    api.getMe()
      .then((data) => {
        setUser(data.user);
        setTokenUsage({
          quota: data.user.quota || 1000000,
          used: data.user.quotaUsed || 0,
        });
      })
      .catch(() => localStorage.removeItem("auth_token"))
      .finally(() => {
        setAuthChecked(true);
        setIsLoading((p) => ({ ...p, app: false }));
      });
  }, []);

  // Load data after auth
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [pRes, trRes, dbs, h] = await Promise.all([
          api.fetchPapers(), api.fetchTrackers(), api.fetchDashboards(), api.healthCheck(),
        ]);
        setPapers(pRes.papers);
        setTrackers(trRes.trackers);
        setDashboards(dbs);
        setHealth(h);
        // Load messages separately (may be empty for new users)
        const msgs = await api.fetchInitialMessages();
        if (msgs.length > 0) setMessages(msgs);
      } catch (e) {
        setErrors((p) => ({ ...p, app: e.message }));
      }
    })();
  }, [user]);

  async function refreshTrackers() {
    setIsLoading((p) => ({ ...p, trackers: true }));
    try {
      const res = await api.fetchTrackers();
      setTrackers(res.trackers);
      setErrors((p) => ({ ...p, trackers: null }));
    } catch (e) {
      setErrors((p) => ({ ...p, trackers: e.message }));
    } finally {
      setIsLoading((p) => ({ ...p, trackers: false }));
    }
  }

  function handleLogin(userData, token) {
    localStorage.setItem("auth_token", token);
    setUser(userData);
    setTokenUsage({
      quota: userData.quota || 1000000,
      used: userData.quotaUsed || 0,
    });
    addToast(t.toastLoginSuccess || (locale === "zh" ? "登录成功" : "Login successful"), "success");
  }

  function handleLogout() {
    localStorage.removeItem("auth_token");
    setUser(null);
    setMessages([]);
    setPapers([]);
    setTrackers([]);
    setDashboards([]);
    setHealth(null);
    setTokenUsage(null);
    setActiveView("ai");
  }

  const stats = useMemo(() => {
    const percentUsed = tokenUsage
      ? Math.round((tokenUsage.used / tokenUsage.quota) * 100)
      : 0;
    return [
      { label: t.activeTrackers, value: String(trackers.length) },
      { label: t.tokenBudget, value: tokenUsage ? `${(tokenUsage.used / 1000).toFixed(0)}K` : "0" },
      { label: t.reusableAssets, value: String(papers.length + dashboards.length) },
      { label: t.monthlyUse, value: `${percentUsed}%` },
    ];
  }, [t, trackers.length, papers.length, dashboards.length, tokenUsage]);

  const setLoading = useCallback((k, v) => setIsLoading((p) => ({ ...p, [k]: v })), []);
  const setError = useCallback((k, v) => setErrors((p) => ({ ...p, [k]: v })), []);
  const clearError = useCallback((k) => setErrors((p) => ({ ...p, [k]: null })), []);

  function switchLocale() {
    const next = locale === "zh" ? "en" : "zh";
    localStorage.setItem("locale", next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    setLocale(next);
  }

  async function submit(event) {
    if (event) event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setLoading("messages", true);
    clearError("messages");
    try {
      const result = await api.submitMessage(text, locale);
      const { message, sideEffects } = result;

      setMessages((c) => [...c,
        { role: "user", kind: "general", text, createdAt: new Date().toISOString() },
        message,
      ]);

      if (sideEffects.tracker) {
        setTrackers((c) => [sideEffects.tracker, ...c]);
        addToast(t.toastTrackerCreated, "success");
      }
      if (sideEffects.draft) {
        setDraft(sideEffects.draft);
        addToast(t.toastDraftGenerated, "success");
      }

      setInput("");
    } catch (e) {
      setError("messages", e.message || t.errorGeneric);
      addToast(t.toastActionFailed, "error");
      setMessages((c) => [...c, { role: "user", kind: "general", text, createdAt: new Date().toISOString() }]);
      setInput("");
    } finally { setLoading("messages", false); }
  }

  function handleSelectPaper(paperId) {
    setSelectedPaperId(paperId);
    startTransition(() => setActiveView("paperDetail"));
  }

  async function handleUpload(files) {
    if (!files?.length) return;
    setLoading("upload", true);
    try {
      const uploaded = await api.uploadPapers(files, locale);
      setPapers((c) => [...uploaded, ...c]);
      addToast(t.toastUploaded, "success");
      setMessages((c) => [...c, { role: "assistant", kind: "pdf",
        text: locale === "zh" ? `已接收 ${files.length} 个 PDF，进入解析队列。` : `Received ${files.length} PDF(s), queued for parsing.`,
        createdAt: new Date().toISOString() }]);
      startTransition(() => setActiveView("library"));
    } catch { addToast(t.toastActionFailed, "error"); }
    finally { setLoading("upload", false); }
  }

  async function refreshPapers() {
    try {
      const res = await api.fetchPapers();
      setPapers(res.papers);
    } catch { /* ignore */ }
  }

  async function handleGenerateDraft() {
    setLoading("draft", true);
    try {
      const draftText = await api.generateDraft(locale, "");
      setDraft(draftText);
      addToast(t.toastDraftGenerated, "success");
    } catch { addToast(t.toastActionFailed, "error"); }
    finally { setLoading("draft", false); }
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey) {
        const map = { "1": "ai", "2": "trackers", "3": "library", "4": "writing", "5": "governance" };
        if (map[e.key]) { e.preventDefault(); startTransition(() => setActiveView(map[e.key])); }
        if (e.key === "6") { e.preventDefault(); startTransition(() => setActiveView("dashboards")); }
        if (e.key === "k") { e.preventDefault(); document.querySelector("textarea")?.focus(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [startTransition]);

  // Loading state
  if (isLoading.app) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  // Login screen
  if (!user) {
    return <Login t={t} locale={locale} onLogin={handleLogin} />;
  }

  const ActiveView = VIEWS[activeView] || VIEWS.ai;
  const vp = {
    ai:          { t, locale, input, setInput, messages, setMessages, setTrackers, setDraft, setActiveView, papers, addToast },
    trackers:    { t, user, trackers, setTrackers, setInput, setActiveView, locale, isLoading: isLoading.trackers, error: errors.trackers, addToast, refreshTrackers },
    library:     { t, user, papers, onUpload: handleUpload, onSelectPaper: handleSelectPaper, isLoading: isLoading.upload, error: errors.papers, refreshPapers },
    writing:     { t, draft, setDraft, locale, onGenerateDraft: handleGenerateDraft, isLoading: isLoading.draft, error: errors.writing },
    governance:  { t, health, tokenUsage, user },
    dashboards:  { t, locale, dashboards, setDashboards, addToast },
    foundry:     { t, locale },
    paperDetail: { t, paperId: selectedPaperId, setActiveView, locale, addToast },
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Header t={t} locale={locale} switchLocale={switchLocale} theme={theme} toggleTheme={toggleTheme} onToggleContext={() => setContextOpen((v) => !v)} user={user} onLogout={handleLogout} />

      <div className="flex h-[calc(100vh-56px)]">
        <aside className="shrink-0 w-[240px] border-r border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-zinc-950/50 overflow-auto">
          <Navigation activeView={activeView} setActiveView={(v) => startTransition(() => setActiveView(v))} t={t} stats={stats} tokenUsage={tokenUsage} />
        </aside>
        <main className={cn("flex-1 min-w-0 overflow-auto transition-opacity duration-150", isPending && "opacity-60")}>
          <ErrorBoundary>
            <ActiveView {...(vp[activeView] || vp.ai)} />
          </ErrorBoundary>
        </main>
      </div>

      <ContextPanel t={t} papers={papers} trackers={trackers} health={health} dashboards={dashboards} open={contextOpen} onClose={() => setContextOpen(false)} />

      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/5 rounded-full px-3 py-1.5 text-[10px] text-muted shadow-lg">
        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-dull">Ctrl+1-6</kbd> views &middot;
        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-dull">Ctrl+K</kbd> chat &middot;
        v0.1.0
      </div>
    </div>
  );
}

export default function App() {
  return <ToastProvider><AppContent /></ToastProvider>;
}
