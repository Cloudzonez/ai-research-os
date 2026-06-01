import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  BookOpen,
  Trash2,
  Send,
  Volume2,
  Play,
  Pause,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  FileText,
  Loader2,
  FileCode,
  LayoutGrid,
  TrendingUp,
  Brain,
  Video,
  FileSpreadsheet,
  AlertCircle
} from "lucide-react";
import { api } from "../../utils/api.js";

export default function NotebookDetailView({
  notebookId,
  onBack,
  t,
  locale,
  addToast,
  papers = []
}) {
  const isZh = locale === "zh";
  const [notebook, setNotebook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingSource, setAddingSource] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Studio and Artifacts
  const [generatingType, setGeneratingType] = useState(null);
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [notesInput, setNotesInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Interactive states for artifact visualizers
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [flipCard, setFlipCard] = useState({});
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [mindMapExpanded, setMindMapExpanded] = useState({});

  const chatEndRef = useRef(null);
  const audioIntervalRef = useRef(null);

  // Load notebook detail
  useEffect(() => {
    async function loadNotebook() {
      try {
        setLoading(true);
        const data = await api.getNotebook(notebookId);
        setNotebook(data);
        // Initialize chat history with a welcoming message
        setChatHistory([
          {
            role: "assistant",
            content: isZh
              ? "欢迎！我是您的 NotebookLM 助手。我已经准备好基于此笔记本中的来源进行解答。您可以提问、让就特定主题进行总结，或使用右侧的工作室生成学习材料。"
              : "Welcome! I am your NotebookLM assistant. I'm ready to answer questions based on the sources in this notebook. You can ask anything, request summaries, or use the Studio on the right to generate custom learning materials.",
            citations: []
          }
        ]);
      } catch (err) {
        addToast?.(err.message || "Failed to load notebook", "error");
      } finally {
        setLoading(false);
      }
    }
    loadNotebook();
  }, [notebookId, isZh, addToast]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Audio timer simulation
  useEffect(() => {
    if (audioPlaying) {
      audioIntervalRef.current = setInterval(() => {
        setAudioProgress((p) => {
          if (p >= 100) {
            setAudioPlaying(false);
            clearInterval(audioIntervalRef.current);
            return 0;
          }
          return p + 1;
        });
      }, 500);
    } else {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    }
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, [audioPlaying]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center bg-gray-50 dark:bg-zinc-950 text-main">
        <Loader2 className="h-6 w-6 text-zinc-400 dark:text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="flex h-[calc(100vh-56px)] flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 text-main">
        <AlertCircle className="h-10 w-10 text-red-500 mb-2" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">{isZh ? "未找到笔记本" : "Notebook not found"}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/5 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {isZh ? "返回列表" : "Back to list"}
        </button>
      </div>
    );
  }

  // Filter sources locally if user searches inside sources list
  const filteredSources = notebook.sources.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Find papers from the full library that are NOT yet in this notebook
  const availablePapers = papers.filter(
    (p) => !notebook.sources.some((s) => s.paperId?.toString() === p._id?.toString())
  );

  async function handleAddSource(paperId) {
    setAddingSource(true);
    try {
      const updatedNotebook = await api.addNotebookSource(notebookId, paperId);
      setNotebook(updatedNotebook);
      addToast?.(isZh ? "已成功添加来源并同步至云端" : "Source added and synced to cloud", "success");
      setShowAddModal(false);
    } catch (err) {
      addToast?.(err.message || "Failed to add source", "error");
    } finally {
      setAddingSource(false);
    }
  }

  async function handleRemoveSource(sourceId) {
    try {
      const updatedNotebook = await api.removeNotebookSource(notebookId, sourceId);
      setNotebook(updatedNotebook);
      addToast?.(isZh ? "来源已移除" : "Source removed successfully", "success");
    } catch (err) {
      addToast?.(err.message || "Failed to remove source", "error");
    }
  }

  async function handleChatSubmit(e) {
    if (e) e.preventDefault();
    const query = chatInput.trim();
    if (!query || chatLoading) return;

    if (notebook.sources.length === 0) {
      addToast?.(isZh ? "请先添加至少一个来源！" : "Please add at least one source first!", "warning");
      return;
    }

    setChatLoading(true);
    setChatInput("");
    
    // Add user message to history
    const userMsg = { role: "user", content: query };
    setChatHistory((prev) => [...prev, userMsg]);

    try {
      // Build history payload for RAG backend
      const historyPayload = chatHistory
        .slice(1) // exclude welcoming message
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await api.notebookChat(notebookId, query, historyPayload);
      
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.text || (isZh ? "未收到回复。" : "No response received."),
          citations: response.citations || []
        }
      ]);
    } catch (err) {
      addToast?.(err.message || "Chat error", "error");
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isZh ? "发生错误，请稍后重试。" : "An error occurred. Please try again.",
          error: true
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleGenerateArtifact(type) {
    if (notebook.sources.length === 0) {
      addToast?.(isZh ? "生成材料需要至少一个来源文件！" : "Generating requires at least one source file!", "warning");
      return;
    }

    setGeneratingType(type);
    try {
      const artifact = await api.generateNotebookArtifact(notebookId, type);
      
      // Reload notebook to fetch updated artifacts list
      const freshNotebook = await api.getNotebook(notebookId);
      setNotebook(freshNotebook);
      
      // Set the newly created artifact as active
      const fullArtifact = freshNotebook.studioArtifacts.find((a) => a.type === type) || artifact;
      setActiveArtifact(fullArtifact);

      // Reset interactive state for the artifact type
      setAudioPlaying(false);
      setAudioProgress(0);
      setActiveSlide(0);
      setQuizAnswers({});
      setQuizScore(0);
      setFlipCard({});
      setFlashcardIndex(0);

      addToast?.(isZh ? "研讨材料生成成功！" : "Artifact generated successfully!", "success");
    } catch (err) {
      addToast?.(err.message || "Failed to generate artifact", "error");
    } finally {
      setGeneratingType(null);
    }
  }

  async function handleSaveNote() {
    const text = notesInput.trim();
    if (!text) return;
    setSavingNote(true);
    try {
      await api.addNotebookNote(notebookId, text);
      const freshNotebook = await api.getNotebook(notebookId);
      setNotebook(freshNotebook);
      setNotesInput("");
      addToast?.(isZh ? "笔记已保存" : "Note saved successfully", "success");
    } catch (err) {
      addToast?.(err.message || "Failed to save note", "error");
    } finally {
      setSavingNote(false);
    }
  }

  // Pre-configured chip prompts
  const CHIPS = isZh
    ? [
        { label: "总结所有来源", prompt: "请对该笔记本里的所有论文来源做一个详细的综合总结，包括核心研究背景、主要贡献和局限性。" },
        { label: "梳理研究方法", prompt: "在这些来源文件中，各论文主要采用了什么研究方法？请列出对比。" },
        { label: "提取核心发现", prompt: "这几篇论文有哪些最重要的科研核心发现或数据指标？" }
      ]
    : [
        { label: "Summarize all sources", prompt: "Please provide a detailed synthesis and summary of all paper sources in this notebook, covering core research backgrounds, main contributions, and limitations." },
        { label: "Compare methodologies", prompt: "What main research methodologies were adopted in these sources? Please compare them." },
        { label: "Extract key findings", prompt: "What are the most significant scientific findings or metrics reported across these papers?" }
      ];

  const STUDIO_BUTTONS = [
    { type: "audio_overview", label: isZh ? "音频播客" : "Audio Overview", icon: Volume2, color: "text-violet-500 dark:text-violet-400" },
    { type: "slide_deck", label: isZh ? "幻灯片大纲" : "Slide Deck", icon: LayoutGrid, color: "text-amber-500 dark:text-amber-400" },
    { type: "video_overview", label: isZh ? "视频脚本" : "Video Overview", icon: Video, color: "text-rose-500 dark:text-rose-400" },
    { type: "mind_map", label: isZh ? "思维导图" : "Mind Map", icon: Brain, color: "text-emerald-500 dark:text-emerald-400" },
    { type: "report", label: isZh ? "综合简报" : "Reports", icon: FileText, color: "text-cyan-500 dark:text-cyan-400" },
    { type: "flashcards", label: isZh ? "学习闪卡" : "Flashcards", icon: RotateCcw, color: "text-fuchsia-500 dark:text-fuchsia-400" },
    { type: "quiz", label: isZh ? "模拟测验" : "Quiz", icon: Sparkles, color: "text-indigo-500 dark:text-indigo-400" },
    { type: "infographic", label: isZh ? "信息图表" : "Infographic", icon: TrendingUp, color: "text-lime-500 dark:text-lime-400" },
    { type: "data_table", label: isZh ? "数据提炼表" : "Data Table", icon: FileSpreadsheet, color: "text-blue-500 dark:text-blue-400" }
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] bg-gray-50/50 dark:bg-zinc-950/20 text-main overflow-hidden font-sans">
      {/* ── LEFT PANEL: Sources ─────────────────────────────────────────── */}
      <aside className="w-80 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4 flex flex-col justify-between shrink-0">
        <div className="flex flex-col gap-4 overflow-hidden h-full">
          {/* Header & Back */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-main truncate leading-snug">{notebook.title}</h2>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {notebook.sources?.length || 0} {notebook.sources?.length === 1 ? "source" : "sources"}
              </p>
            </div>
          </div>

          {/* Add source button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-main rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 border border-gray-200 dark:border-transparent"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-500" />
            {isZh ? "添加论文来源" : "Add sources"}
          </button>

          {/* Search inside sources */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
            <input
              className="w-full bg-white dark:bg-zinc-900 border border-gray-250 dark:border-zinc-800/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-main placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
              placeholder={isZh ? "搜索已添加来源..." : "Search notebook sources..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Sources List */}
          <div className="flex-1 overflow-auto flex flex-col gap-1.5 pr-1">
            {filteredSources.map((source) => (
              <div
                key={source._id}
                className="group flex items-start gap-2.5 p-2.5 rounded-lg bg-white dark:bg-zinc-900 hover:bg-gray-150 dark:hover:bg-zinc-850/80 border border-gray-200/60 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-colors relative"
              >
                <FileText className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-main truncate leading-snug">
                    {source.title}
                  </h4>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded leading-none inline-block mt-1">
                    {source.type || "paper"}
                  </span>
                </div>
                {/* Delete button */}
                <button
                  onClick={() => handleRemoveSource(source._id)}
                  className="p-1 text-zinc-400 dark:text-zinc-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            {filteredSources.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-400 dark:text-zinc-600">
                <BookOpen className="h-7 w-7 mb-2 opacity-40" />
                <p className="text-[11px] font-semibold">{isZh ? "无匹配的来源文档" : "No sources matching"}</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Web Sync Mock */}
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-zinc-800/60">
          <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-widest">
            {isZh ? "快速同步" : "Quick Sync Status"}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-dull bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-2.5 rounded-lg">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="truncate">{isZh ? "已原子同步至谷歌云节点" : "Atomically synced with Google Cloud"}</span>
          </div>
        </div>
      </aside>

      {/* ── CENTER PANEL: Grounded Chat ─────────────────────────────────── */}
      <main className="flex-1 flex flex-col justify-between overflow-hidden bg-white/30 dark:bg-zinc-950/10 border-r border-gray-200 dark:border-zinc-800">
        {/* Chat History */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {chatHistory.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 max-w-3xl ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
            >
              <div
                className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${
                  msg.role === "user" ? "bg-gray-200 dark:bg-zinc-800" : "bg-emerald-600 text-white"
                }`}
              >
                {msg.role === "user" ? (
                  <span className="text-[11px] font-extrabold text-zinc-500 dark:text-zinc-300">U</span>
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="flex flex-col gap-1.5 max-w-2xl">
                <div
                  className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gray-150 dark:bg-zinc-800 text-main rounded-tr-none"
                      : msg.error
                      ? "bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-300 rounded-tl-none"
                      : "bg-white dark:bg-zinc-900 text-main rounded-tl-none border border-gray-200 dark:border-white/5"
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                  
                  {/* Grounded Citations Display */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-gray-200 dark:border-zinc-850 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mr-1">
                        {isZh ? "数据可信依据:" : "Grounded Citations:"}
                      </span>
                      {msg.citations.map((cite, cIdx) => (
                        <span
                          key={cIdx}
                          title={cite.text || cite.webSource?.uri}
                          className="flex items-center gap-1 text-[9px] font-semibold bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded cursor-help border border-gray-250 dark:border-zinc-700"
                        >
                          <BookOpen className="h-2.5 w-2.5" />
                          {cite.webSource?.title || cite.derivedSource?.sourceDisplayName || `Source [${cIdx + 1}]`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {chatLoading && (
            <div className="flex gap-3 mr-auto">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-600 text-white shrink-0">
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/5 text-zinc-500 dark:text-zinc-400 rounded-2xl rounded-tl-none p-4 text-xs flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                <span>{isZh ? "正在查阅来源文档进行可信解答..." : "Consulting sources for grounded response..."}</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestion Chips */}
        {chatHistory.length <= 1 && (
          <div className="px-6 pb-2 flex flex-wrap gap-2 max-w-3xl">
            {CHIPS.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setChatInput(chip.prompt);
                }}
                className="text-[11px] px-3.5 py-1.5 rounded-full border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 text-dull hover:text-main transition-all duration-200"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={handleChatSubmit} className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-900/10">
          <div className="max-w-3xl mx-auto flex gap-2 relative items-center">
            <textarea
              rows={1}
              className="flex-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-main placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 transition-all resize-none pr-12"
              placeholder={isZh ? "基于此笔记本的来源提问..." : "Ask questions based on your sources..."}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSubmit();
                }
              }}
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="absolute right-2 p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </main>

      {/* ── RIGHT PANEL: Studio & Notes ─────────────────────────────────── */}
      <aside className="w-96 p-4 border-l border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/20 overflow-auto flex flex-col gap-6 shrink-0">
        {/* Studio Title */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <h3 className="text-xs font-bold text-main uppercase tracking-wider">{isZh ? "学术工作坊 Studio" : "Studio"}</h3>
            </div>
            <span className="text-[9px] font-black bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/60 uppercase tracking-widest leading-none">
              {isZh ? "AI 研讨辅助" : "AI Coprocessor"}
            </span>
          </div>
          <p className="text-[11px] text-dull leading-normal mb-4">
            {isZh
              ? "一键基于当前同步的所有论文来源，自动提炼并结构化生成以下 9 种研讨辅助材料。"
              : "Generate highly structured study materials instantly based on the current synchronized documents."}
          </p>

          {/* 9-Button Grid */}
          <div className="grid grid-cols-3 gap-2">
            {STUDIO_BUTTONS.map((btn) => {
              const Icon = btn.icon;
              const isGenerating = generatingType === btn.type;
              return (
                <button
                  key={btn.type}
                  disabled={!!generatingType}
                  onClick={() => handleGenerateArtifact(btn.type)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/40 hover:bg-gray-50 dark:hover:bg-zinc-800/80 hover:border-gray-300 dark:hover:border-zinc-700 text-center transition-all cursor-pointer relative active:scale-95 group disabled:opacity-50"
                >
                  {isGenerating ? (
                    <Loader2 className="h-5 w-5 text-zinc-400 dark:text-zinc-500 animate-spin mb-1.5" />
                  ) : (
                    <Icon className={`h-4.5 w-4.5 ${btn.color} mb-1.5 group-hover:scale-110 transition-transform`} />
                  )}
                  <span className="text-[10px] text-main font-semibold leading-tight break-words max-w-full">
                    {btn.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Generated Artifacts Section */}
        {notebook.studioArtifacts && notebook.studioArtifacts.length > 0 && (
          <div className="border-t border-gray-250 dark:border-zinc-800/80 pt-4">
            <h4 className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-widest">
              {isZh ? "已生成研讨材料" : "Generated Materials"}
            </h4>
            <div className="flex flex-col gap-1.5">
              {notebook.studioArtifacts.map((art) => {
                const spec = STUDIO_BUTTONS.find((b) => b.type === art.type);
                const Icon = spec?.icon || FileText;
                const active = activeArtifact?._id === art._id;
                return (
                  <button
                    key={art._id}
                    onClick={() => {
                      setActiveArtifact(art);
                      // Reset views on switch
                      setActiveSlide(0);
                      setAudioPlaying(false);
                      setAudioProgress(0);
                      setQuizAnswers({});
                      setQuizScore(0);
                      setFlipCard({});
                      setFlashcardIndex(0);
                    }}
                    className={`flex items-center gap-2.5 w-full p-2.5 rounded-lg border text-left transition-colors text-xs ${
                      active
                        ? "bg-gray-150 dark:bg-zinc-800 border-gray-250 dark:border-zinc-700 text-main font-bold shadow-inner"
                        : "bg-white/40 dark:bg-zinc-900/30 border-gray-200/50 dark:border-transparent hover:border-gray-300 dark:hover:border-zinc-800 text-dull hover:text-main"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${spec?.color || "text-zinc-400"}`} />
                    <span className="truncate flex-1">{art.title}</span>
                    <Sparkles className="h-3 w-3 text-emerald-500 shrink-0 animate-pulse" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* User Notes Section */}
        <div className="border-t border-gray-250 dark:border-zinc-800/80 pt-4 flex flex-col gap-3">
          <h4 className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            {isZh ? "研讨笔记 / Draft Notes" : "Studio Notes"}
          </h4>
          
          {/* Notes list */}
          {notebook.notes && notebook.notes.length > 0 && (
            <div className="flex flex-col gap-2 max-h-40 overflow-auto pr-1">
              {notebook.notes.map((note, nIdx) => (
                <div key={note._id || nIdx} className="bg-white dark:bg-zinc-900/80 p-2.5 rounded-lg border border-gray-200 dark:border-zinc-800 text-[11px] text-main leading-normal">
                  <p>{note.content}</p>
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-550 block mt-1 text-right font-mono">
                    {new Date(note.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Quick note input */}
          <div className="flex gap-2">
            <input
              className="flex-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-main placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
              placeholder={isZh ? "随手记录下您的启发..." : "Jot down your inspirations..."}
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveNote()}
            />
            <button
              onClick={handleSaveNote}
              disabled={savingNote || !notesInput.trim()}
              className="px-3 py-1.5 bg-gray-150 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-50 text-main rounded-lg text-xs font-semibold transition-colors border border-gray-250 dark:border-transparent"
            >
              {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : isZh ? "保存" : "Save"}
            </button>
          </div>
        </div>
      </aside>

      {/* ── OVERLAY MODAL: Premium Artifact Viewers ─────────────────────────── */}
      {activeArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-md p-6">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50/50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-transparent">
                  <Sparkles className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-main leading-snug">{activeArtifact.title}</h3>
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-semibold mt-0.5">
                    {isZh ? `基于 ${notebook.sources.length} 个来源文件生成` : `Synthesized from ${notebook.sources.length} sources`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveArtifact(null);
                  setAudioPlaying(false);
                  setAudioProgress(0);
                }}
                className="p-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50/20 dark:bg-zinc-950/25">
              {/* 1. AUDIO OVERVIEW (PODCAST PLAYER) */}
              {activeArtifact.type === "audio_overview" && (
                <div className="flex flex-col items-center justify-center py-6 text-center max-w-lg mx-auto text-main">
                  <div className="relative h-24 w-24 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-2xl shadow-xl flex items-center justify-center mb-6">
                    <Volume2 className="h-10 w-10 text-white" />
                    {audioPlaying && (
                      <span className="absolute inset-0 rounded-2xl bg-violet-600/30 animate-ping" />
                    )}
                  </div>
                  <h4 className="text-base font-extrabold text-main mb-1">
                    {isZh ? "AI 双主播研讨播客" : "2-Host RAG Podcast Overview"}
                  </h4>
                  <p className="text-xs text-dull mb-6 leading-relaxed">
                    {isZh
                      ? "主播 A & B 已根据您的论文，自动生成了深入浅出的中英文学术对话。"
                      : "Hosts A & B have generated a lively conversation analyzing your papers."}
                  </p>

                  {/* Audio Controls */}
                  <div className="flex items-center gap-4 w-full mb-6 text-dull">
                    <span className="text-[10px] font-mono">00:{String(Math.floor(audioProgress * 0.3)).padStart(2, "0")}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden relative">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300"
                        style={{ width: `${audioProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono">00:30</span>
                  </div>

                  <div className="flex items-center gap-3 mb-8">
                    <button
                      onClick={() => setAudioProgress(0)}
                      className="p-2.5 bg-gray-150 dark:bg-zinc-850 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full text-zinc-400 dark:text-zinc-500 hover:text-main transition-colors border border-gray-250 dark:border-transparent"
                      title="Restart"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setAudioPlaying(!audioPlaying)}
                      className="p-3.5 bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-105 active:scale-95 rounded-full font-bold shadow-lg transition-all"
                    >
                      {audioPlaying ? <Pause className="h-4.5 w-4.5 fill-current" /> : <Play className="h-4.5 w-4.5 fill-current" />}
                    </button>
                    <div className="w-10 h-10" /> {/* Spacer */}
                  </div>

                  {/* Moving Audio Wave visualization */}
                  {audioPlaying && (
                    <div className="flex gap-1 h-6 items-end justify-center mb-8">
                      {[1, 2, 3, 4, 5, 6, 8, 10, 8, 6, 5, 4, 3, 2, 1].map((val, key) => (
                        <div
                          key={key}
                          className="w-1 bg-violet-500 dark:bg-violet-400 rounded-full animate-pulse"
                          style={{
                            height: `${val * 2.4}px`,
                            animationDelay: `${key * 75}ms`
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Script Transcript */}
                  <div className="w-full text-left bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 p-4 rounded-xl max-h-56 overflow-auto">
                    <h5 className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2.5">
                      {isZh ? "实时播客脚本文字稿" : "Generated Podcast Transcript"}
                    </h5>
                    <div className="space-y-3.5 text-xs text-dull font-sans leading-relaxed">
                      {typeof activeArtifact.content === "string" ? (
                        activeArtifact.content.split("\n").map((line, lKey) => {
                          const isHostA = line.startsWith("Host A:") || line.startsWith("A:");
                          const isHostB = line.startsWith("Host B:") || line.startsWith("B:");
                          if (isHostA || isHostB) {
                            return (
                              <p key={lKey} className="pl-3 border-l-2 border-gray-200 dark:border-zinc-700">
                                <span className={isHostA ? "text-violet-500 dark:text-violet-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                                  {isHostA ? "Host A: " : "Host B: "}
                                </span>
                                {line.replace(/^(Host [A|B]:\s*|[A|B]:\s*)/, "")}
                              </p>
                            );
                          }
                          return <p key={lKey}>{line}</p>;
                        })
                      ) : (
                        <p>{isZh ? "未生成文本稿。" : "No text transcript."}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. SLIDE DECK (INTERACTIVE SLIDES) */}
              {activeArtifact.type === "slide_deck" && (
                <div className="max-w-2xl mx-auto flex flex-col gap-6">
                  {(() => {
                    const slides = activeArtifact.content?.slides || [];
                    const currentSlide = slides[activeSlide] || {
                      title: isZh ? "引言 / Introduction" : "Slide Title",
                      bullets: [isZh ? "无幻灯片内容" : "No slide bullets available"],
                      speakerNotes: ""
                    };
                    return (
                      <>
                        {/* Interactive Slide Panel */}
                        <div className="aspect-[16/9] w-full rounded-2xl bg-gradient-to-br from-gray-50 dark:from-zinc-800 to-white dark:to-zinc-950 border border-gray-200 dark:border-zinc-700/80 p-8 shadow-xl flex flex-col justify-between relative overflow-hidden group">
                          {/* Design grid ornament */}
                          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
                          <div className="absolute -top-16 -right-16 h-36 w-36 rounded-full bg-amber-500/5 dark:bg-amber-500/10 blur-2xl" />

                          {/* Slide Header */}
                          <div className="relative flex justify-between items-start">
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 tracking-widest uppercase">
                              SLIDE {activeSlide + 1} OF {slides.length || 1}
                            </span>
                            <Sparkles className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                          </div>

                          {/* Slide Title */}
                          <h4 className="relative text-xl sm:text-2xl font-extrabold text-main leading-tight">
                            {currentSlide.title}
                          </h4>

                          {/* Slide Bullets */}
                          <ul className="relative space-y-3 my-2 flex-1 flex flex-col justify-center">
                            {currentSlide.bullets?.map((b, key) => (
                              <li key={key} className="flex items-start gap-2.5 text-dull text-xs sm:text-sm leading-normal">
                                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0 mt-2" />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>

                          {/* Slide Footer */}
                          <div className="relative border-t border-gray-200 dark:border-zinc-800 pt-3 flex justify-between items-center text-[10px] text-zinc-400 dark:text-zinc-500">
                            <span>{notebook.title}</span>
                            <span>{isZh ? "AI 研制幻灯片" : "Generated by AI Research OS"}</span>
                          </div>
                        </div>

                        {/* Navigation Panel */}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setActiveSlide((s) => Math.max(0, s - 1))}
                            disabled={activeSlide === 0}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 disabled:opacity-50 text-main rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors border border-gray-250 dark:border-transparent"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            {isZh ? "上一页" : "Prev"}
                          </button>
                          
                          <div className="flex gap-1">
                            {Array.from({ length: slides.length }).map((_, idx) => (
                              <div
                                key={idx}
                                className={`h-1.5 w-1.5 rounded-full ${idx === activeSlide ? "bg-amber-500 dark:bg-amber-400" : "bg-gray-200 dark:bg-zinc-750"}`}
                              />
                            ))}
                          </div>

                          <button
                            onClick={() => setActiveSlide((s) => Math.min(slides.length - 1, s + 1))}
                            disabled={activeSlide === (slides.length - 1)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 disabled:opacity-50 text-main rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors border border-gray-250 dark:border-transparent"
                          >
                            {isZh ? "下一页" : "Next"}
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Speaker Notes */}
                        {currentSlide.speakerNotes && (
                          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 p-4 rounded-xl">
                            <h5 className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">
                              {isZh ? "演讲者备注 (Speaker Notes)" : "Speaker Notes"}
                            </h5>
                            <p className="text-xs text-dull leading-relaxed italic">
                              "{currentSlide.speakerNotes}"
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 3. VIDEO OVERVIEW (STORYBOARD/SCRIPT PLAYER) */}
              {activeArtifact.type === "video_overview" && (
                <div className="max-w-2xl mx-auto flex flex-col gap-6">
                  {/* Mock Video player with Canvas gradient animation overlay */}
                  <div className="aspect-video w-full rounded-2xl bg-zinc-950 border border-zinc-850 shadow-xl flex flex-col justify-between p-4 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-rose-950/20 to-zinc-900" />
                    
                    {/* Animated color spot to mock player overlay */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-10">
                      <div className="h-14 w-14 bg-white/10 backdrop-blur-md border border-white/20 hover:scale-105 rounded-full flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-all">
                        <Play className="h-5 w-5 text-rose-400 fill-current ml-1" />
                      </div>
                      <span className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase">
                        {isZh ? "预览学术故事版视频" : "PREVIEW STORYBOARD VIDEO"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs text-zinc-550 z-10">
                      <span>VideoOverview_Draft.mp4</span>
                      <span className="bg-rose-950 text-rose-400 px-2 py-0.5 rounded font-mono text-[9px]">HD</span>
                    </div>

                    {/* Progress Bar Mocks */}
                    <div className="flex items-center gap-3 w-full text-[10px] text-zinc-400 font-mono z-10 bg-zinc-950/70 p-2.5 rounded-lg border border-white/5">
                      <span>00:00</span>
                      <div className="flex-1 h-1 rounded-full bg-zinc-855">
                        <div className="h-full w-1/12 bg-rose-500" />
                      </div>
                      <span>04:15</span>
                    </div>
                  </div>

                  {/* Narration Scenes Script */}
                  <div className="bg-white dark:bg-zinc-900 border border-gray-250 dark:border-zinc-800 p-5 rounded-2xl flex flex-col gap-4">
                    <h4 className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest border-b border-gray-200 dark:border-zinc-800 pb-2">
                      {isZh ? "深度科普分镜脚本" : "Video Storyboard Script"}
                    </h4>
                    <div className="space-y-4 max-h-64 overflow-auto pr-1">
                      {typeof activeArtifact.content === "string" ? (
                        activeArtifact.content.split("\n\n").map((scene, sIdx) => (
                          <div key={sIdx} className="bg-gray-50/50 dark:bg-zinc-950/30 p-3 rounded-lg border border-gray-200 dark:border-zinc-800/80">
                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Scene {sIdx + 1}
                            </span>
                            <p className="text-xs text-dull leading-relaxed mt-2 whitespace-pre-line">
                              {scene}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-zinc-500">{isZh ? "未提供文字脚本。" : "No text script available."}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. MIND MAP (INTERACTIVE FOLDERS/TREES) */}
              {activeArtifact.type === "mind_map" && (
                <div className="max-w-2xl mx-auto p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl">
                  {(() => {
                    const data = activeArtifact.content || {};
                    const central = data.central || (isZh ? "学术中心概念" : "Core Topic");
                    const branches = data.branches || [];

                    return (
                      <div className="flex flex-col items-center">
                        {/* Central Hub Node */}
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 border border-emerald-500 p-4 rounded-2xl shadow-xl text-center max-w-sm mb-8">
                          <h4 className="text-sm font-black text-white uppercase tracking-wider">{central}</h4>
                          <span className="text-[9px] text-emerald-100 bg-emerald-700/50 px-2 py-0.5 rounded mt-1.5 inline-block">
                            {isZh ? "核心主题" : "Central Hub"}
                          </span>
                        </div>

                        {/* Connection Lines (Simulated by layout structure) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                          {branches.map((branch, bIdx) => {
                            const expanded = !!mindMapExpanded[bIdx];
                            return (
                              <div
                                key={bIdx}
                                className="bg-gray-50/50 dark:bg-zinc-950/40 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-emerald-500/40 transition-colors"
                              >
                                {/* Branch Header Node */}
                                <button
                                  onClick={() =>
                                    setMindMapExpanded((prev) => ({
                                      ...prev,
                                      [bIdx]: !prev[bIdx]
                                    }))
                                  }
                                  className="w-full flex items-center justify-between p-3.5 text-left border-b border-gray-200 dark:border-zinc-800/80 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors text-main"
                                >
                                  <div className="flex items-center gap-2">
                                    <Brain className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                                    <span className="text-xs font-bold">{branch.label}</span>
                                  </div>
                                  <span className="text-[9px] bg-white dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-500 border border-gray-200 dark:border-transparent">
                                    {expanded ? (isZh ? "折叠" : "Collapse") : (isZh ? "展开" : "Expand")}
                                  </span>
                                </button>

                                {/* Children Subnodes */}
                                {expanded && (
                                  <div className="p-3 space-y-2 bg-gray-50/10 dark:bg-zinc-900/10">
                                    {branch.children?.map((child, cIdx) => (
                                      <div
                                        key={cIdx}
                                        className="flex items-start gap-2 text-xs text-dull p-2 rounded bg-white dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800"
                                      >
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                                        <span>{child}</span>
                                      </div>
                                    ))}
                                    {(!branch.children || branch.children.length === 0) && (
                                      <p className="text-[10px] text-zinc-500 p-2 italic">{isZh ? "无子分支节点" : "No child nodes available"}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 5. REPORTS (EXECUTIVE SUMMARY BRIEFING) */}
              {activeArtifact.type === "report" && (
                <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-8 rounded-2xl font-serif text-dull leading-relaxed shadow-xl max-h-[60vh] overflow-auto">
                  <div className="text-center border-b border-gray-200 dark:border-zinc-800 pb-5 mb-6">
                    <h3 className="text-lg sm:text-xl font-bold text-main mb-2 font-sans tracking-wide">
                      {isZh ? "AI 学术研讨综合简报" : "Grounded Research Synthesis Briefing"}
                    </h3>
                    <p className="text-[9px] font-sans font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                      {isZh ? `官方 NotebookLM API 生成 & 沉淀` : `Generated by NotebookLM API Sync Engine`}
                    </p>
                  </div>
                  
                  {/* Clean Markdown styled text format */}
                  <div className="space-y-4 text-xs sm:text-sm whitespace-pre-line font-sans">
                    {typeof activeArtifact.content === "string" ? (
                      activeArtifact.content
                    ) : (
                      <p className="text-zinc-400 italic">{isZh ? "暂无报告正文。" : "No report content."}</p>
                    )}
                  </div>
                </div>
              )}

              {/* 6. FLASHCARDS (INTERACTIVE FLIP CARD GRID) */}
              {activeArtifact.type === "flashcards" && (
                <div className="max-w-md mx-auto flex flex-col gap-6">
                  {(() => {
                    const cards = activeArtifact.content?.flashcards || [];
                    const count = cards.length;
                    const card = cards[flashcardIndex] || {
                      front: isZh ? "空闪卡正面" : "No card question",
                      back: isZh ? "空闪卡背面" : "No card answer"
                    };
                    const isFlipped = !!flipCard[flashcardIndex];

                    return (
                      <>
                        {/* Grid Flip container */}
                        <div
                          onClick={() =>
                            setFlipCard((prev) => ({
                              ...prev,
                              [flashcardIndex]: !prev[flashcardIndex]
                            }))
                          }
                          className="aspect-[4/3] w-full rounded-2xl cursor-pointer bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800/80 p-8 flex flex-col justify-between relative shadow-xl hover:border-fuchsia-500/40 transition-colors"
                        >
                          <div className="flex justify-between items-center text-[9px] font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">
                            <span>CARD {flashcardIndex + 1} OF {count || 1}</span>
                            <span className="text-fuchsia-500 dark:text-fuchsia-400 uppercase tracking-widest">{isFlipped ? (isZh ? "背面: 答案" : "BACK: ANSWER") : (isZh ? "正面: 提问" : "FRONT: QUESTION")}</span>
                          </div>

                          <div className="flex-1 flex items-center justify-center text-center p-4">
                            <p className={`text-sm sm:text-base leading-relaxed ${isFlipped ? "text-fuchsia-600 dark:text-fuchsia-300 font-bold" : "text-main font-semibold"}`}>
                              {isFlipped ? card.back : card.front}
                            </p>
                          </div>

                          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center italic">
                            {isZh ? "(点击卡片翻面看解答)" : "(Click card to flip and reveal answer)"}
                          </div>
                        </div>

                        {/* Navigation controls */}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => {
                              setFlashcardIndex((idx) => Math.max(0, idx - 1));
                            }}
                            disabled={flashcardIndex === 0}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 disabled:opacity-50 text-main rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors border border-gray-250 dark:border-transparent"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            {isZh ? "上一张" : "Prev"}
                          </button>

                          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">
                            {flashcardIndex + 1} / {count}
                          </span>

                          <button
                            onClick={() => {
                              setFlashcardIndex((idx) => Math.min(count - 1, idx + 1));
                            }}
                            disabled={flashcardIndex === count - 1}
                            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 disabled:opacity-50 text-main rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors border border-gray-250 dark:border-transparent"
                          >
                            {isZh ? "下一张" : "Next"}
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 7. QUIZ (INTERACTIVE MULTIPLE CHOICE SYSTEM) */}
              {activeArtifact.type === "quiz" && (
                <div className="max-w-xl mx-auto flex flex-col gap-6">
                  {(() => {
                    const questions = activeArtifact.content?.questions || [];
                    const totalQuestions = questions.length;
                    
                    return (
                      <div className="space-y-6">
                        {/* Score Board */}
                        <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-4 rounded-xl text-main">
                          <div>
                            <h4 className="text-xs font-extrabold uppercase tracking-wider">{isZh ? "学术自测挑战" : "Scientific Quiz Challenge"}</h4>
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{isZh ? "实时计分 & 解析反馈" : "Realtime scoring and analysis"}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{isZh ? "正确率:" : "Correct:"}</span>
                            <p className="text-base font-black text-indigo-600 dark:text-indigo-400">{quizScore} / {totalQuestions}</p>
                          </div>
                        </div>

                        {/* Questions list */}
                        <div className="space-y-4 max-h-[50vh] overflow-auto pr-1">
                          {questions.map((q, qIdx) => {
                            const userAnswer = quizAnswers[qIdx];
                            const isCorrect = userAnswer === q.answer;
                            const hasAnswered = userAnswer !== undefined;

                            return (
                              <div
                                key={qIdx}
                                className="bg-white dark:bg-zinc-900/45 border border-gray-200 dark:border-zinc-800 p-5 rounded-xl space-y-3"
                              >
                                <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                                  QUESTION {qIdx + 1}
                                </span>
                                <h5 className="text-xs sm:text-sm font-bold text-main leading-relaxed">
                                  {q.question}
                                </h5>

                                {/* Options Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                  {q.options?.map((opt, optKey) => {
                                    const optionLetter = opt.trim().substring(0, 1).toUpperCase();
                                    
                                    const selected = userAnswer === optionLetter;
                                    const correctOpt = q.answer === optionLetter;

                                    let btnStyle = "border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 bg-gray-50/20 dark:bg-zinc-950/20";
                                    if (hasAnswered) {
                                      if (correctOpt) {
                                        btnStyle = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-300";
                                      } else if (selected && !isCorrect) {
                                        btnStyle = "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-300";
                                      } else {
                                        btnStyle = "border-gray-200/40 dark:border-zinc-800/40 bg-zinc-950/5 text-zinc-400 dark:text-zinc-600 opacity-60";
                                      }
                                    } else {
                                      if (selected) {
                                        btnStyle = "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300";
                                      }
                                    }

                                    return (
                                      <button
                                        key={optKey}
                                        disabled={hasAnswered}
                                        onClick={() => {
                                          setQuizAnswers((prev) => ({
                                            ...prev,
                                            [qIdx]: optionLetter
                                          }));
                                          if (q.answer === optionLetter) {
                                            setQuizScore((s) => s + 1);
                                          }
                                        }}
                                        className={`flex items-center gap-2.5 p-3 text-left rounded-lg border text-xs leading-normal transition-all duration-200 ${btnStyle}`}
                                      >
                                        <span className="h-5 w-5 shrink-0 rounded-full border border-current/25 flex items-center justify-center font-bold font-mono text-[10px]">
                                          {optionLetter}
                                        </span>
                                        <span className="truncate">{opt.replace(/^[A-D]\)?\s*/i, "")}</span>
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Explanation Feedback */}
                                {hasAnswered && (
                                  <div className={`mt-3 p-3 rounded-lg text-xs leading-normal border ${
                                    isCorrect ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-50/30 dark:bg-red-950/10 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400"
                                  }`}>
                                    <div className="flex items-center gap-1.5 font-bold mb-1">
                                      {isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                      <span>{isCorrect ? (isZh ? "回答正确！" : "Correct!") : (isZh ? `回答错误！正确答案为 ${q.answer}` : `Wrong! Correct answer is ${q.answer}`)}</span>
                                    </div>
                                    <p className="text-[11px] text-dull">{q.explanation}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 8. INFOGRAPHIC (SLEEK PROGRESS DASHBOARD) */}
              {activeArtifact.type === "infographic" && (
                <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6 text-main">
                  {(() => {
                    const data = activeArtifact.content || {};
                    const title = data.title || (isZh ? "学术文献可视化指标" : "Key Visualization Dashboard");
                    const stats = data.stats || [];
                    const keyPoints = data.keyPoints || [];
                    
                    return (
                      <>
                        <div className="text-center pb-4 border-b border-gray-200 dark:border-zinc-800">
                          <h4 className="text-sm sm:text-base font-bold text-main">{title}</h4>
                          <p className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5">{isZh ? "核心指标与关键观点沉淀" : "Metrics and key take-aways"}</p>
                        </div>

                        {/* Statistic circle badges */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {stats.map((stat, sKey) => (
                            <div key={sKey} className="bg-gray-50/50 dark:bg-zinc-950/40 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
                              <span className="text-xl sm:text-2xl font-black text-lime-600 dark:text-lime-400 leading-none mb-1.5">{stat.value}</span>
                              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight font-semibold">{stat.label}</span>
                            </div>
                          ))}
                          {stats.length === 0 && (
                            <p className="col-span-4 text-xs text-zinc-400 text-center italic">{isZh ? "无指标数据" : "No stat metrics available"}</p>
                          )}
                        </div>

                        {/* keyPoint highlights */}
                        <div className="space-y-2.5">
                          <h5 className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{isZh ? "核心要点提炼" : "Key Research Points"}</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {keyPoints.map((point, pKey) => (
                              <div key={pKey} className="flex gap-2.5 p-3 rounded-lg bg-gray-50/30 dark:bg-zinc-950/20 border border-gray-200 dark:border-zinc-800/80 text-xs text-dull leading-relaxed items-start">
                                <span className="h-5 w-5 bg-lime-50 dark:bg-lime-950 text-lime-700 dark:text-lime-400 border border-lime-200 dark:border-lime-800/50 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black">{pKey + 1}</span>
                                <span>{point}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {data.conclusion && (
                          <div className="bg-gray-50/20 dark:bg-zinc-950/30 p-3 rounded-lg border border-gray-200 dark:border-zinc-800 text-xs text-dull italic text-center">
                            "{data.conclusion}"
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 9. DATA TABLE (METRIC COLUMNS GRID) */}
              {activeArtifact.type === "data_table" && (
                <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                  {(() => {
                    const data = activeArtifact.content || {};
                    const headers = data.headers || [];
                    const rows = data.rows || [];
                    
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          {/* Table Headers */}
                          <thead>
                            <tr className="bg-gray-50 dark:bg-zinc-950/60 border-b border-gray-200 dark:border-zinc-800">
                              {headers.map((h, key) => (
                                <th key={key} className="p-3.5 font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>

                          {/* Table Rows */}
                          <tbody>
                            {rows.map((row, rKey) => (
                              <tr
                                key={rKey}
                                className="border-b border-gray-200 dark:border-zinc-800/50 hover:bg-gray-50/50 dark:hover:bg-zinc-950/20 transition-colors"
                              >
                                {row.map((cell, cKey) => (
                                  <td key={cKey} className="p-3.5 text-main whitespace-pre-wrap leading-relaxed">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}

                            {rows.length === 0 && (
                              <tr>
                                <td colSpan={headers.length || 1} className="p-10 text-center text-zinc-400 dark:text-zinc-650 italic">
                                  {isZh ? "表格中无提取数据" : "No metric rows extracted"}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        
                        {data.caption && (
                          <div className="bg-gray-50/30 dark:bg-zinc-950/20 px-4 py-3 border-t border-gray-200 dark:border-zinc-800 text-[10px] text-zinc-400 dark:text-zinc-500 italic text-center">
                            {data.caption}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── OVERLAY MODAL: Add Sources Paper Library Selector ─────────────────── */}
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] animate-fade-in text-main"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-zinc-800 mb-4 shrink-0">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-main">
                  {isZh ? "选择库中论文导入" : "Select papers from Library"}
                </h3>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {isZh
                    ? "将论文导入该笔记本，并实时同步至 Google 研讨云节点。"
                    : "Add papers to sync as grounded context on Google Cloud."}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-main rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto space-y-2 pr-1">
              {availablePapers.map((paper) => (
                <div
                  key={paper._id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50/50 dark:bg-zinc-950/40 border border-gray-200 dark:border-zinc-800/80 hover:border-gray-300 dark:hover:border-zinc-700 transition-all text-xs"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <h5 className="font-bold text-main truncate leading-snug">{paper.title}</h5>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                      {paper.authors?.join(", ") || (isZh ? "未知作者" : "Unknown Authors")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAddSource(paper._id)}
                    disabled={addingSource}
                    className="flex items-center gap-1 shrink-0 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg transition-colors text-xs"
                  >
                    {addingSource ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        {isZh ? "添加" : "Add"}
                      </>
                    )}
                  </button>
                </div>
              ))}

              {availablePapers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400 dark:text-zinc-500">
                  <FileCode className="h-9 w-9 opacity-30 mb-2" />
                  <p className="text-xs font-semibold">{isZh ? "共享文库中没有更多论文，请先前往共享文库上传！" : "No more papers in Library! Please upload in Library first."}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
