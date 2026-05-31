import React from "react";
import { Globe2, PanelRightOpen, Sun, Moon, LogOut, User, Shield } from "lucide-react";

export default function Header({ t, locale, switchLocale, theme, toggleTheme, onToggleContext, user, onLogout, onNavigate }) {
  return (
    <header className="glass sticky top-0 z-40 flex h-14 items-center justify-between px-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500 rotate-45" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-main hidden sm:inline">
            {t.product}
          </span>
        </div>
        <span className="hidden lg:inline text-faint text-xs">&middot;</span>
        <span className="hidden lg:inline text-muted text-xs truncate max-w-md">{t.headline}</span>
      </div>

      <div className="flex items-center gap-1">
        {user && (
          <div className="flex items-center gap-2 mr-2 text-xs">
            <button
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => onNavigate?.("profile")}
              title={locale === "zh" ? "个人信息" : "Profile"}
            >
              <User className="h-3 w-3 text-emerald-500" />
              <span className="text-main font-medium hidden sm:inline">{user.name}</span>
              <span className="text-[10px] text-muted hidden md:inline">{user.email}</span>
            </button>
            {user.role === "admin" && (
              <button
                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-colors cursor-pointer flex items-center gap-0.5"
                onClick={() => onNavigate?.("admin")}
                title={locale === "zh" ? "管理面板" : "Admin Dashboard"}
              >
                <Shield className="h-3 w-3" />
                Admin
              </button>
            )}
            {user.role === "teacher" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 font-medium flex items-center gap-0.5">
                <User className="h-3 w-3" />
                {locale === "zh" ? "教师" : "Teacher"}
              </span>
            )}
          </div>
        )}
        <button className="btn-ghost h-8 px-2" type="button" onClick={switchLocale} title={locale === "zh" ? "English" : "中文"}>
          <Globe2 className="h-4 w-4" />
          <span className="text-xs ml-1">{locale === "zh" ? "EN" : "中"}</span>
        </button>
        <button className="btn-ghost h-8 w-8 p-0" type="button" onClick={toggleTheme} title={theme === "light" ? "Dark mode" : "Light mode"}>
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
        <button className="btn-ghost h-8" type="button" onClick={onToggleContext}>
          <PanelRightOpen className="h-4 w-4" />
        </button>
        {user && (
          <button className="btn-ghost h-8 w-8 p-0 text-muted hover:text-red-500" type="button" onClick={onLogout} title={locale === "zh" ? "退出" : "Logout"}>
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}
