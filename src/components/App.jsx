import React, { useState, useEffect, useCallback, useMemo, useTransition } from "react";
import copy from "../i18n/index.js";
import { api } from "../utils/api.js";
import { cn } from "../utils/cn.js";
import ToastProvider, { useToast } from "./Toast.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
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
import PaperDetailView from "./views/PaperDetailView.jsx";
import ProfileView from "./views/ProfileView.jsx";
import AdminDashboardView from "./views/AdminDashboardView.jsx";

const VIEWS = {
  ai: AiCenter,
  trackers: TrackersView,
  library: LibraryView,
  writing: WritingView,
  governance: GovernanceView,
  foundry: FoundryView,
  paperDetail: PaperDetailView,
  profile: ProfileView,
  admin: AdminDashboardView,
};

function AppContent() {
  const { addToast } = useToast();
  const { user, isAdmin, loading: authLoading, logout } = useAuth();
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
  const [crawlers, setCrawlers] = useState([]);
  const [health, setHealth] = useState(null);
  const [tokenUsage, setTokenUsage] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  const [isLoading, setIsLoading] = useState({ app: false, messages: false, upload: false, draft: false });
  const [errors, setErrors] = useState({ trackers: null, papers: null, writing: null, messages: null });

  const t = useMemo(() => copy[locale], [locale]);

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  function toggleTheme() { setTheme((t) => (t === "light" ? "dark" : "light")); }

  // Load data after auth
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [p, trks, cr, h, sess] = await Promise.all([
          api.fetchPapers(), api.fetchTrackers(), api.getCrawlers(), api.healthCheck(), api.getSessions(),
        ]);
        setPapers(p);
        setTrackers(trks);
        setCrawlers(cr);
        setHealth(h);
        setSessions(sess);
        // If there are sessions, load the most recent one; otherwise load legacy messages
        if (sess.length > 0) {
          const latest = sess[0];
          setActiveSessionId(latest._id);
          const { messages: msgs } = await api.getSessionMessages(latest._id);
          setMessages(msgs);
        } else {
          const msgs = await api.fetchInitialMessages();
          if (msgs.length > 0) setMessages(msgs);
        }
      } catch (e) {
        setErrors((p) => ({ ...p, app: e.message }));
      }
    })();
  }, [user]);

  // ── Session management ────────────────────────
  async function handleNewChat() {
    try {
      const session = await api.createSession(locale === "zh" ? "新对话" : "New Chat");
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session._id);
      setMessages([]);
      handleSetActiveView("ai");
    } catch (e) {
      addToast(locale === "zh" ? "创建对话失败" : "Failed to create chat", "error");
    }
  }

  async function handleSelectSession(sessionId) {
    try {
      setMessages([]); // Clear messages immediately to avoid cross-session bleed
      setActiveSessionId(sessionId);
      handleSetActiveView("ai");
      const { messages: msgs } = await api.getSessionMessages(sessionId);
      setMessages(msgs);
    } catch (e) {
      addToast(locale === "zh" ? "加载对话失败" : "Failed to load chat", "error");
    }
  }

  async function handleRenameSession(sessionId, title) {
    try {
      const updated = await api.renameSession(sessionId, title);
      setSessions((prev) => prev.map((s) => s._id === sessionId ? updated : s));
    } catch (e) {
      addToast(locale === "zh" ? "重命名失败" : "Rename failed", "error");
    }
  }

  async function handleDeleteSession(sessionId) {
    try {
      await api.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
      addToast(locale === "zh" ? "对话已删除" : "Chat deleted", "success");
    } catch (e) {
      addToast(locale === "zh" ? "删除失败" : "Delete failed", "error");
    }
  }

  async function handleToggleMarkSession(sessionId) {
    try {
      const updated = await api.toggleMarkSession(sessionId);
      setSessions((prev) => prev.map((s) => s._id === sessionId ? updated : s));
    } catch (e) {
      addToast(locale === "zh" ? "操作失败" : "Operation failed", "error");
    }
  }

  async function handleToggleShareSession(sessionId) {
    try {
      const updated = await api.toggleShareSession(sessionId);
      setSessions((prev) => prev.map((s) => s._id === sessionId ? updated : s));
      if (updated.isShared && updated.shareToken) {
        const shareUrl = `${window.location.origin}/api/sessions/shared/${updated.shareToken}`;
        try { await navigator.clipboard.writeText(shareUrl); } catch {}
        addToast(locale === "zh" ? "分享链接已复制" : "Share link copied", "success");
      } else {
        addToast(locale === "zh" ? "已取消分享" : "Sharing disabled", "success");
      }
    } catch (e) {
      addToast(locale === "zh" ? "操作失败" : "Operation failed", "error");
    }
  }

  // Auto-rename session based on first user message
  async function refreshSessionTitle(sessionId, firstMessageText) {
    // Check if this session still has the default name
    const session = sessions.find((s) => s._id === sessionId);
    if (!session) return;
    const isDefault = session.title === "New Chat" || session.title === "新对话";
    const newTitle = firstMessageText.slice(0, 50) + (firstMessageText.length > 50 ? "..." : "");

    // Update local state immediately
    setSessions((prev) => prev.map((s) => {
      if (s._id === sessionId && isDefault) {
        return { ...s, title: newTitle, updatedAt: new Date().toISOString() };
      }
      if (s._id === sessionId) {
        return { ...s, updatedAt: new Date().toISOString() };
      }
      return s;
    }));

    // Persist to backend if it was a default name
    if (isDefault) {
      try {
        await api.renameSession(sessionId, newTitle);
      } catch (e) {
        console.warn("Failed to auto-rename session:", e);
      }
    }
  }

  function handleLogin(userData, token) {
    // Login is handled by AuthContext now, but we still handle toast
    setTokenUsage({
      quota: userData.quota || 1000000,
      used: userData.quotaUsed || 0,
    });
    addToast(t.toastLoginSuccess || (locale === "zh" ? "登录成功" : "Login successful"), "success");
  }

  function handleLogout() {
    logout();
    setMessages([]);
    setPapers([]);
    setTrackers([]);
    setCrawlers([]);
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
      { label: t.reusableAssets, value: String(papers.length + crawlers.length) },
      { label: t.monthlyUse, value: `${percentUsed}%` },
    ];
  }, [t, trackers.length, papers.length, crawlers.length, tokenUsage]);

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

  async function handleGenerateDraft() {
    setLoading("draft", true);
    try {
      const draftText = await api.generateDraft(locale, "");
      setDraft(draftText);
      addToast(t.toastDraftGenerated, "success");
    } catch { addToast(t.toastActionFailed, "error"); }
    finally { setLoading("draft", false); }
  }

  // Guard admin-only views for teachers
  function handleSetActiveView(viewId) {
    const adminOnlyViews = ["governance", "foundry", "admin"];
    if (adminOnlyViews.includes(viewId) && !isAdmin) {
      addToast(locale === "zh" ? "此功能仅管理员可用" : "This feature is admin-only", "error");
      return;
    }
    startTransition(() => setActiveView(viewId));
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey) {
        const map = { "1": "ai", "2": "trackers", "3": "library", "4": "writing" };
        if (map[e.key]) { e.preventDefault(); handleSetActiveView(map[e.key]); }
        if (e.key === "5" && isAdmin) { e.preventDefault(); handleSetActiveView("governance"); }
        if (e.key === "6" && isAdmin) { e.preventDefault(); handleSetActiveView("foundry"); }
        if (e.key === "k") { e.preventDefault(); document.querySelector("textarea")?.focus(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [startTransition, isAdmin]);

  // Loading state
  if (authLoading) {
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
    ai:          { t, locale, input, setInput, messages, setMessages, setTrackers, setCrawlers, setDraft, setActiveView: handleSetActiveView, papers, addToast, activeSessionId, onNewChat: handleNewChat, refreshSessionTitle, sessions, onSelectSession: handleSelectSession, onRenameSession: handleRenameSession, onDeleteSession: handleDeleteSession, onToggleMarkSession: handleToggleMarkSession, onToggleShareSession: handleToggleShareSession },
    trackers:    { t, trackers, setTrackers, setInput, setActiveView: handleSetActiveView, locale, isLoading: false, error: errors.trackers, addToast },
    library:     { t, locale, papers, onUpload: handleUpload, onSelectPaper: handleSelectPaper, isLoading: isLoading.upload, error: errors.papers, addToast },
    writing:     { t, draft, setDraft, locale, onGenerateDraft: handleGenerateDraft, isLoading: isLoading.draft, error: errors.writing },
    governance:  { t, health, tokenUsage, crawlers },
    foundry:     { t, locale },
    paperDetail: { t, paperId: selectedPaperId, setActiveView: handleSetActiveView, locale, addToast },
    profile:     { t, locale, addToast },
    admin:       { t, locale, addToast, health },
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Header
        t={t} locale={locale} switchLocale={switchLocale}
        theme={theme} toggleTheme={toggleTheme}
        onToggleContext={() => setContextOpen((v) => !v)}
        user={user} onLogout={handleLogout}
        onNavigate={handleSetActiveView}
      />

      <div className="flex h-[calc(100vh-56px)]">
        <aside className="shrink-0 w-[240px] border-r border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-zinc-950/50 overflow-auto">
          <Navigation activeView={activeView} setActiveView={handleSetActiveView} t={t} stats={stats} tokenUsage={tokenUsage} isAdmin={isAdmin} />
        </aside>
        <main className={cn("flex-1 min-w-0 overflow-auto transition-opacity duration-150", isPending && "opacity-60")}>
          <ErrorBoundary>
            <ActiveView {...(vp[activeView] || vp.ai)} />
          </ErrorBoundary>
        </main>
      </div>

      <ContextPanel t={t} papers={papers} trackers={trackers} health={health} crawlers={crawlers} open={contextOpen} onClose={() => setContextOpen(false)} />

      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/5 rounded-full px-3 py-1.5 text-[10px] text-muted shadow-lg">
        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-dull">Ctrl+1-{isAdmin ? "6" : "4"}</kbd> views &middot;
        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-dull">Ctrl+K</kbd> chat &middot;
        v0.1.0
      </div>
    </div>
  );
}

function AppWithAuth() {
  const [tokenUsage, setTokenUsage] = useState(null);

  return (
    <AuthProvider onTokenUsageUpdate={setTokenUsage}>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default function App() {
  return <AppWithAuth />;
}
