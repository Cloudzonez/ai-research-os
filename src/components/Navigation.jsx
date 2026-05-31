import React from "react";
import { cn } from "../utils/cn.js";

const NAV_ITEMS = [
  { id: "ai",         icon: "M8.625 9.75c0 .621.504 1.125 1.125 1.125h1.5c.621 0 1.125-.504 1.125-1.125V5.25h-3.75v4.5Zm-3.75 3c0 .621.504 1.125 1.125 1.125h1.5c.621 0 1.125-.504 1.125-1.125v-7.5h-3.75v7.5Z", adminOnly: false },
  { id: "trackers",   icon: "M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm5.658 7.757A8.974 8.974 0 0 0 12 13a8.974 8.974 0 0 0-6.658 2.757A3.959 3.959 0 0 0 4 18.5v.8c0 .387.313.7.7.7h14.6c.387 0 .7-.313.7-.7v-.8c0-1.06-.422-2.076-1.172-2.826Z", adminOnly: false },
  { id: "library",    icon: "M4 4.5A2.5 2.5 0 0 1 6.5 2h11A2.5 2.5 0 0 1 20 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5v-15Z", adminOnly: false },
  { id: "writing",    icon: "M15.232 5.232a1.5 1.5 0 0 1 2.121 0l1.415 1.414a1.5 1.5 0 0 1 0 2.121l-9.9 9.9a1.5 1.5 0 0 1-.683.394l-3.5.875a.75.75 0 0 1-.914-.914l.875-3.5a1.5 1.5 0 0 1 .394-.683l9.9-9.9Z", adminOnly: false },
  { id: "governance", icon: "M12 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM3.5 8a8.5 8.5 0 0 1 14.132-4.95l1.344-1.345a.5.5 0 0 1 .854.354V7H15a.5.5 0 0 1-.354-.854l1.233-1.233A7.5 7.5 0 0 0 4.41 9.254a.75.75 0 0 1-1.39-.486A8.443 8.443 0 0 1 3.5 8Z", adminOnly: true },
  { id: "foundry",    icon: "M4.5 4.5a2.25 2.25 0 0 1 2.25-2.25h10.5A2.25 2.25 0 0 1 19.5 4.5v15a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5v-15Z M8.25 12h7.5M12 8.25v7.5", adminOnly: true },
  { id: "admin",      icon: "M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3A5.25 5.25 0 0 0 12 1.5Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z", adminOnly: true },
];

const LABELS = {
  ai: "aiCenter", trackers: "trackers", library: "library", writing: "writing",
  governance: "governance", foundry: "foundry", admin: "adminDashboard",
};

export default function Navigation({ activeView, setActiveView, t, stats, tokenUsage, isAdmin }) {
  const percentUsed = tokenUsage
    ? Math.min(100, Math.round((tokenUsage.used / tokenUsage.quota) * 100))
    : 0;

  // Filter nav items based on role
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="flex flex-col gap-1 p-2">
      {visibleItems.map((item) => {
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 h-9 text-[13px] font-medium transition-all duration-200 w-full",
              active
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm"
                : "text-dull hover:text-main hover:bg-gray-200/70 dark:hover:bg-white/5",
              item.adminOnly && "border-l-2 border-amber-400/50",
            )}
            type="button" onClick={() => setActiveView(item.id)}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path d={item.icon} />
            </svg>
            <span className="truncate">{t[LABELS[item.id]] || item.id}</span>
            {item.adminOnly && !active && (
              <span className="ml-auto text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                Admin
              </span>
            )}
          </button>
        );
      })}

      {/* Separator between nav and stats */}
      {isAdmin && (
        <div className="mx-2 my-1 border-t border-gray-200 dark:border-white/5" />
      )}

      <div className="mt-3 px-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{t.tokenBudget}</span>
          <span className="text-[11px] text-faint">{percentUsed}%</span>
        </div>
        <div className="h-1 rounded-full bg-gray-200 dark:bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-emerald-500"
            style={{ width: `${percentUsed}%` }}
          />
        </div>
        {tokenUsage && (
          <div className="mt-1 text-[10px] text-muted text-right">
            {(tokenUsage.used / 1000).toFixed(0)}K / {(tokenUsage.quota / 1000).toFixed(0)}K
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-gray-100 dark:bg-white/[0.03] px-2.5 py-2">
              <div className="text-sm font-semibold text-main">{stat.value}</div>
              <div className="text-[10px] text-muted truncate">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
