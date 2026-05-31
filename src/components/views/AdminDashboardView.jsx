import React, { useState, useEffect } from "react";
import { Users, Shield, ToggleLeft, ToggleRight, Search, RefreshCw, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { api } from "../../utils/api.js";

export default function AdminDashboardView({ t, locale, addToast, health }) {
  const { isAdmin } = useAuth();
  const isZh = locale === "zh";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
  }, [isAdmin]);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await api.adminGetUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || (isZh ? "加载用户失败" : "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(userId, currentActive) {
    try {
      const updated = await api.adminUpdateUser(userId, { active: !currentActive });
      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, ...updated.user } : u)));
      addToast?.(isZh ? "用户状态已更新" : "User status updated", "success");
    } catch (err) {
      addToast?.(err.message || (isZh ? "操作失败" : "Action failed"), "error");
    }
  }

  async function handleChangeRole(userId, newRole) {
    try {
      const updated = await api.adminUpdateUser(userId, { role: newRole });
      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, ...updated.user } : u)));
      addToast?.(isZh ? "角色已更新" : "Role updated", "success");
    } catch (err) {
      addToast?.(err.message || (isZh ? "操作失败" : "Action failed"), "error");
    }
  }

  async function handleUpdateQuota(userId, newQuota) {
    try {
      const updated = await api.adminUpdateUser(userId, { quota: newQuota });
      setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, ...updated.user } : u)));
      addToast?.(isZh ? "配额已更新" : "Quota updated", "success");
    } catch (err) {
      addToast?.(err.message || (isZh ? "操作失败" : "Action failed"), "error");
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        <Shield className="h-12 w-12 mb-4 text-red-400" />
        <h3 className="text-lg font-semibold">{isZh ? "无权限" : "Access Denied"}</h3>
        <p className="text-sm mt-1">{isZh ? "此页面仅管理员可见" : "This page is only accessible to administrators"}</p>
      </div>
    );
  }

  const filteredUsers = users
    .filter((u) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (sortDir === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.active).length,
    admins: users.filter((u) => u.role === "admin").length,
    teachers: users.filter((u) => u.role === "teacher").length,
  };

  function SortIcon({ field }) {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />;
  }

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-main flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-500" />
          {isZh ? "管理面板" : "Admin Dashboard"}
        </h2>
        <button className="btn-ghost h-8 text-xs" onClick={loadUsers}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          {isZh ? "刷新" : "Refresh"}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: isZh ? "总用户" : "Total Users", value: stats.total, color: "bg-blue-500/20 text-blue-600 dark:text-blue-400" },
          { label: isZh ? "活跃用户" : "Active Users", value: stats.active, color: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" },
          { label: isZh ? "管理员" : "Admins", value: stats.admins, color: "bg-amber-500/20 text-amber-600 dark:text-amber-400" },
          { label: isZh ? "教师" : "Teachers", value: stats.teachers, color: "bg-purple-500/20 text-purple-600 dark:text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="surface p-4">
            <div className={`text-2xl font-bold ${s.color.split(" ").slice(1).join(" ")}`}>{s.value}</div>
            <div className="text-xs text-muted mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* System Health */}
      {health && (
        <div className="surface p-4">
          <h3 className="text-sm font-semibold text-main mb-2">{isZh ? "系统状态" : "System Health"}</h3>
          <div className="flex items-center gap-4 text-xs">
            <span className={`px-2 py-1 rounded ${health.status === "ok" ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-500/20 text-red-700"}`}>
              {health.status === "ok" ? (isZh ? "正常" : "Healthy") : (isZh ? "异常" : "Unhealthy")}
            </span>
            {health.db && <span className="text-muted">DB: {health.db}</span>}
            {health.uptime && <span className="text-muted">Uptime: {Math.floor(health.uptime / 60)}m</span>}
          </div>
        </div>
      )}

      {/* User Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            type="text"
            placeholder={isZh ? "搜索用户..." : "Search users..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted">
          {filteredUsers.length} {isZh ? "个用户" : "users"}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/5">
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("name")}>
                  {isZh ? "姓名" : "Name"} <SortIcon field="name" />
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("email")}>
                  Email <SortIcon field="email" />
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider">
                  {isZh ? "角色" : "Role"}
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider">
                  {isZh ? "配额" : "Quota"}
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider">
                  {isZh ? "状态" : "Status"}
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("createdAt")}>
                  {isZh ? "创建时间" : "Created"} <SortIcon field="createdAt" />
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-medium text-muted uppercase tracking-wider">
                  {isZh ? "操作" : "Actions"}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted text-xs">
                  <div className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
                </td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted text-xs">
                  {isZh ? "暂无用户" : "No users found"}
                </td></tr>
              ) : filteredUsers.map((u) => (
                <tr key={u._id} className="border-b border-gray-100 dark:border-white/[0.02] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-main">{u.name}</td>
                  <td className="px-4 py-3 text-muted text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="text-xs bg-transparent border border-gray-200 dark:border-white/10 rounded px-1.5 py-0.5"
                      value={u.role}
                      onChange={(e) => handleChangeRole(u._id, e.target.value)}
                    >
                      <option value="teacher">{isZh ? "教师" : "Teacher"}</option>
                      <option value="admin">{isZh ? "管理员" : "Admin"}</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {((u.quotaUsed || 0) / 1000).toFixed(0)}K / {((u.quota || 1000000) / 1000).toFixed(0)}K
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      u.active
                        ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                        : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
                    }`}>
                      {u.active ? (isZh ? "活跃" : "Active") : (isZh ? "禁用" : "Disabled")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="btn-ghost h-7 text-[11px] px-2"
                      onClick={() => handleToggleActive(u._id, u.active)}
                      title={u.active ? (isZh ? "禁用" : "Disable") : (isZh ? "启用" : "Enable")}
                    >
                      {u.active ? (
                        <><ToggleRight className="h-3.5 w-3.5 mr-1 text-emerald-500" />{isZh ? "禁用" : "Disable"}</>
                      ) : (
                        <><ToggleLeft className="h-3.5 w-3.5 mr-1 text-red-400" />{isZh ? "启用" : "Enable"}</>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
