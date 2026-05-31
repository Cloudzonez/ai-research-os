import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MessageSquarePlus, Star, Trash2, Pencil, Share2, MoreHorizontal, Check, X, Link2, StarOff } from "lucide-react";

function groupSessionsByDate(sessions, locale) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
  const monthAgo = new Date(today); monthAgo.setDate(today.getDate() - 30);

  const isZh = locale === "zh";
  const groups = {
    marked:   { label: isZh ? "📌 已标记" : "📌 Marked", items: [] },
    today:    { label: isZh ? "今天" : "Today", items: [] },
    yesterday:{ label: isZh ? "昨天" : "Yesterday", items: [] },
    week:     { label: isZh ? "最近7天" : "Previous 7 days", items: [] },
    month:    { label: isZh ? "最近30天" : "Previous 30 days", items: [] },
    older:    { label: isZh ? "更早" : "Older", items: [] },
  };

  for (const s of sessions) {
    if (s.isMarked) { groups.marked.items.push(s); continue; }
    const d = new Date(s.updatedAt || s.createdAt);
    if (d >= today) groups.today.items.push(s);
    else if (d >= yesterday) groups.yesterday.items.push(s);
    else if (d >= weekAgo) groups.week.items.push(s);
    else if (d >= monthAgo) groups.month.items.push(s);
    else groups.older.items.push(s);
  }

  return Object.values(groups).filter(g => g.items.length > 0);
}

function SessionItem({ session, isActive, onSelect, onRename, onDelete, onToggleMark, onToggleShare, locale }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const menuRef = useRef(null);
  const btnRef = useRef(null);
  const inputRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const isZh = locale === "zh";

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function openMenu(e) {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: Math.min(rect.right - 160, window.innerWidth - 170) });
    }
    setMenuOpen(!menuOpen);
  }

  function handleRename() {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== session.title) onRename(session._id, trimmed);
    setEditing(false);
  }

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] cursor-pointer transition-all duration-150 ${
        isActive
          ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
          : "text-dull hover:text-main hover:bg-gray-200/70 dark:hover:bg-white/5"
      }`}
      onClick={() => !editing && onSelect(session._id)}
    >
      {/* Icon */}
      <span className="shrink-0 text-[11px]">
        {session.isMarked ? "⭐" : "💬"}
      </span>

      {/* Title or edit input */}
      {editing ? (
        <div className="flex-1 flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            className="flex-1 bg-white dark:bg-zinc-800 rounded px-1.5 py-0.5 text-xs text-main border border-gray-300 dark:border-white/10 outline-none"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditing(false); }}
            maxLength={100}
          />
          <button onClick={handleRename} className="p-0.5 text-emerald-500 hover:text-emerald-600"><Check className="h-3 w-3" /></button>
          <button onClick={() => setEditing(false)} className="p-0.5 text-red-400 hover:text-red-500"><X className="h-3 w-3" /></button>
        </div>
      ) : (
        <span className="flex-1 truncate">{session.title}</span>
      )}

      {/* Shared indicator */}
      {session.isShared && !editing && (
        <Link2 className="h-3 w-3 text-blue-400 shrink-0" />
      )}

      {/* More menu button */}
      {!editing && (
        <>
          <button
            ref={btnRef}
            className={`p-0.5 rounded transition-opacity shrink-0 ${
              isActive ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-70 hover:!opacity-100"
            }`}
            onClick={openMenu}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>

          {menuOpen && createPortal(
            <div
              ref={menuRef}
              className="fixed z-[9999] w-40 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 shadow-xl py-1 text-xs"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 text-left text-dull"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setEditing(true); setEditTitle(session.title); }}
              >
                <Pencil className="h-3 w-3" /> {isZh ? "重命名" : "Rename"}
              </button>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 text-left text-dull"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleMark(session._id); }}
              >
                {session.isMarked
                  ? <><StarOff className="h-3 w-3" /> {isZh ? "取消标记" : "Unmark"}</>
                  : <><Star className="h-3 w-3" /> {isZh ? "标记" : "Mark"}</>
                }
              </button>
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 text-left text-dull"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleShare(session._id); }}
              >
                <Share2 className="h-3 w-3" /> {session.isShared ? (isZh ? "取消分享" : "Unshare") : (isZh ? "分享" : "Share")}
              </button>
              <div className="my-1 border-t border-gray-200 dark:border-white/5" />
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-left text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  const confirmed = window.confirm(isZh ? `确定要删除对话 "${session.title}" 吗？此操作不可撤销。` : `Are you sure you want to delete "${session.title}"? This action cannot be undone.`);
                  if (confirmed) onDelete(session._id);
                }}
              >
                <Trash2 className="h-3 w-3" /> {isZh ? "删除" : "Delete"}
              </button>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}

export default function ChatHistory({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onRename,
  onDelete,
  onToggleMark,
  onToggleShare,
  locale,
}) {
  const isZh = locale === "zh";
  const groups = groupSessionsByDate(sessions, locale);

  return (
    <div className="flex flex-col gap-1 flex-1 min-h-0">
      {/* New Chat button */}
      <button
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors w-full"
        onClick={onNewChat}
      >
        <MessageSquarePlus className="h-4 w-4" />
        {isZh ? "新对话" : "New Chat"}
      </button>

      {/* Session groups */}
      <div className="mt-1 space-y-2 overflow-auto flex-1 min-h-0">
        {groups.length === 0 && (
          <p className="px-3 py-2 text-[11px] text-muted italic">
            {isZh ? "暂无对话记录" : "No conversations yet"}
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted">
              {group.label}
            </div>
            {group.items.map((session) => (
              <SessionItem
                key={session._id}
                session={session}
                isActive={activeSessionId === session._id}
                onSelect={onSelectSession}
                onRename={onRename}
                onDelete={onDelete}
                onToggleMark={onToggleMark}
                onToggleShare={onToggleShare}
                locale={locale}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
