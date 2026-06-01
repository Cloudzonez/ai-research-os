import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, BookOpen, MoreVertical, Trash2, Clock, Loader2 } from "lucide-react";
import { api } from "../../utils/api.js";

// Cover gradient palettes (mirrors NotebookLM's vibrant card colors)
const COVERS = [
  "from-violet-600 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-cyan-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
  "from-lime-500 to-green-600",
  "from-sky-500 to-blue-700",
];

function getCover(notebook) {
  if (notebook.coverImage) return null; // has custom image
  const idx = notebook._id
    ? parseInt(notebook._id.slice(-2), 16) % COVERS.length
    : 0;
  return COVERS[idx];
}

function NotebookCard({ notebook, onClick, onDelete, isDeleting }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const gradient = getCover(notebook);

  return (
    <div
      className="relative group rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg border border-gray-200/50 dark:border-white/5"
      style={{ minHeight: 120 }}
      onClick={() => onClick(notebook)}
    >
      {/* Background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient || "from-zinc-700 to-zinc-800"}`}
        style={
          notebook.coverImage
            ? {
                backgroundImage: `url(${notebook.coverImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {}
        }
      />
      <div className="absolute inset-0 bg-black/20" />

      {/* Content */}
      <div className="relative p-4 h-full flex flex-col justify-between" style={{ minHeight: 120 }}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1 truncate">
              {notebook.sourceCount || 0} {notebook.sourceCount === 1 ? "source" : "sources"}
            </p>
            <h3 className="text-sm font-extrabold text-white leading-snug line-clamp-2">
              {notebook.title}
            </h3>
          </div>

          {/* 3-dot menu */}
          <div className="relative ml-2 shrink-0">
            <button
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <MoreVertical className="h-3.5 w-3.5 text-white" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-8 z-30 w-36 rounded-lg bg-white dark:bg-zinc-850 border border-gray-200 dark:border-white/10 shadow-xl py-1 text-main"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(notebook._id);
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete notebook
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          <Clock className="h-3 w-3 text-white/60" />
          <span className="text-[10px] text-white/60 font-semibold">
            {new Date(notebook.updatedAt || notebook.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function CreateCard({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="relative rounded-xl border-2 border-dashed border-gray-300 dark:border-zinc-700 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 bg-white dark:bg-zinc-900/40 hover:bg-emerald-500/[0.02] dark:hover:bg-emerald-500/[0.02] transition-all cursor-pointer flex flex-col items-center justify-center gap-2 p-4 group"
      style={{ minHeight: 120 }}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 text-zinc-400 dark:text-zinc-500 animate-spin" />
      ) : (
        <Plus className="h-5 w-5 text-zinc-400 dark:text-zinc-500 group-hover:scale-110 transition-transform group-hover:text-emerald-500" />
      )}
      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold group-hover:text-emerald-500 transition-colors">
        {loading ? "Creating..." : "Create new notebook"}
      </span>
    </button>
  );
}

export default function NotebooksHomeView({ t, locale, addToast, onOpenNotebook }) {
  const isZh = locale === "zh";
  const [notebooks, setNotebooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const loadNotebooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getNotebooks();
      setNotebooks(data);
    } catch (err) {
      addToast?.(err.message || "Failed to load notebooks", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadNotebooks();
  }, [loadNotebooks]);

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const notebook = await api.createNotebook(title);
      setNotebooks((prev) => [notebook, ...prev]);
      setShowCreateModal(false);
      setNewTitle("");
      addToast?.(isZh ? "笔记本已创建" : "Notebook created", "success");
      onOpenNotebook?.(notebook);
    } catch (err) {
      addToast?.(err.message || "Failed to create notebook", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await api.deleteNotebook(id);
      setNotebooks((prev) => prev.filter((n) => n._id !== id));
      addToast?.(isZh ? "笔记本已删除" : "Notebook deleted", "success");
    } catch (err) {
      addToast?.(err.message || "Failed to delete notebook", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = notebooks.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Split into featured (first 5) and recent (rest)
  const featured = filtered.slice(0, 5);
  const recent = filtered;

  return (
    <div className="p-6 text-main min-h-full bg-gray-50/50 dark:bg-zinc-950/20">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-emerald-500 shrink-0" />
            <h1 className="text-lg font-bold text-main">
              {isZh ? "笔记本 Workspaces" : "Notebooks"}
            </h1>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              <input
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-main placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 transition-all w-48 sm:w-56"
                placeholder={isZh ? "搜索笔记本..." : "Search notebooks..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Create button */}
            <button
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors shadow-sm shadow-emerald-500/15"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {isZh ? "新建笔记本" : "Create new"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-zinc-400 dark:text-zinc-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Featured notebooks — horizontal scroll */}
            {featured.length > 0 && (
              <section className="mb-8">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                  {isZh ? "精选笔记本 / Featured" : "Featured notebooks"}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {featured.map((nb) => (
                    <NotebookCard
                      key={nb._id}
                      notebook={nb}
                      onClick={onOpenNotebook}
                      onDelete={handleDelete}
                      isDeleting={deletingId === nb._id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Recent notebooks grid */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                {isZh ? "最近笔记本 / Recent Workspaces" : "Recent notebooks"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Create new tile */}
                <CreateCard
                  onClick={() => setShowCreateModal(true)}
                  loading={creating}
                />
                {recent.map((nb) => (
                  <NotebookCard
                    key={nb._id}
                    notebook={nb}
                    onClick={onOpenNotebook}
                    onDelete={handleDelete}
                    isDeleting={deletingId === nb._id}
                  />
                ))}
              </div>

              {recent.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <BookOpen className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-3" />
                  <p className="text-zinc-500 text-xs font-semibold">
                    {isZh ? "还没有笔记本。点击上方新建一个。" : "No notebooks yet. Create one above."}
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Create Notebook Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-main mb-1">
              {isZh ? "新建笔记本" : "New notebook"}
            </h3>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mb-4 leading-normal">
              {isZh
                ? "创建后将与云端 Google NotebookLM 企业节点建立原子同步连接。"
                : "A pairing connection will be established atomically on Google NotebookLM cloud."}
            </p>
            <input
              autoFocus
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-main placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 transition-all mb-4"
              placeholder={isZh ? "请输入笔记本标题..." : "Notebook title..."}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div className="flex gap-2 justify-end">
              <button
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                onClick={() => setShowCreateModal(false)}
              >
                {isZh ? "取消" : "Cancel"}
              </button>
              <button
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
                onClick={handleCreate}
                disabled={creating || !newTitle.trim()}
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isZh ? "创建" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
