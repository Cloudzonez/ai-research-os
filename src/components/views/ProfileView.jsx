import React, { useState } from "react";
import { User, Mail, Shield, Key, Save, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { api } from "../../utils/api.js";

export default function ProfileView({ t, locale, addToast }) {
  const { user, updateUser } = useAuth();
  const isZh = locale === "zh";

  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const percentUsed = user?.quota
    ? Math.min(100, Math.round(((user.quotaUsed || 0) / user.quota) * 100))
    : 0;

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const result = await api.updateProfile({ name });
      updateUser(result.user);
      setSuccess(isZh ? "个人信息已更新" : "Profile updated successfully");
      addToast?.(isZh ? "个人信息已更新" : "Profile updated", "success");
    } catch (err) {
      setError(err.message || (isZh ? "更新失败" : "Update failed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError(isZh ? "新密码至少6个字符" : "New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(isZh ? "两次密码不一致" : "Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(isZh ? "密码已更新" : "Password changed successfully");
      addToast?.(isZh ? "密码已更新" : "Password changed", "success");
    } catch (err) {
      setError(err.message || (isZh ? "密码修改失败" : "Password change failed"));
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-lg font-semibold text-main">
        {isZh ? "个人信息" : "Profile"}
      </h2>

      {/* User Info Card */}
      <div className="surface p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <User className="h-7 w-7 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-main">{user.name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Mail className="h-3.5 w-3.5" />
              {user.email}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                user.role === "admin"
                  ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"
                  : "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400"
              }`}>
                <Shield className="h-3 w-3 inline mr-0.5" />
                {user.role === "admin" ? (isZh ? "管理员" : "Admin") : (isZh ? "教师" : "Teacher")}
              </span>
              <span className="text-[10px] text-muted">
                {isZh ? "语言" : "Language"}: {user.language === "zh" ? "中文" : "English"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Token Quota Card */}
      <div className="surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-main">
          {isZh ? "Token 配额" : "Token Quota"}
        </h3>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{isZh ? "已使用" : "Used"}</span>
          <span className="font-medium text-main">
            {((user.quotaUsed || 0) / 1000).toFixed(0)}K / {((user.quota || 1000000) / 1000).toFixed(0)}K
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 dark:bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percentUsed > 90 ? "bg-red-500" : percentUsed > 70 ? "bg-yellow-500" : "bg-emerald-500"
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
        <p className="text-[11px] text-muted">
          {isZh
            ? `本月已使用 ${percentUsed}% 的 Token 配额`
            : `${percentUsed}% of monthly token quota used`}
        </p>
      </div>

      {/* Update Profile Form */}
      <form onSubmit={handleUpdateProfile} className="surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-main">
          {isZh ? "修改信息" : "Update Profile"}
        </h3>
        <div>
          <label className="text-[11px] font-medium text-muted uppercase tracking-wider">
            {isZh ? "姓名" : "Name"}
          </label>
          <input
            className="input mt-1"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button className="btn-primary" type="submit" disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1.5 inline" />
          {saving ? (isZh ? "保存中..." : "Saving...") : (isZh ? "保存" : "Save")}
        </button>
      </form>

      {/* Change Password Form */}
      <form onSubmit={handleChangePassword} className="surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-main">
          <Key className="h-4 w-4 inline mr-1.5" />
          {isZh ? "修改密码" : "Change Password"}
        </h3>
        <div>
          <label className="text-[11px] font-medium text-muted uppercase tracking-wider">
            {isZh ? "当前密码" : "Current Password"}
          </label>
          <input
            className="input mt-1"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted uppercase tracking-wider">
            {isZh ? "新密码" : "New Password"}
          </label>
          <input
            className="input mt-1"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={isZh ? "至少6个字符" : "At least 6 characters"}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted uppercase tracking-wider">
            {isZh ? "确认新密码" : "Confirm New Password"}
          </label>
          <input
            className="input mt-1"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <button className="btn-primary" type="submit" disabled={saving}>
          <Key className="h-3.5 w-3.5 mr-1.5 inline" />
          {saving ? (isZh ? "更新中..." : "Updating...") : (isZh ? "更新密码" : "Update Password")}
        </button>
      </form>

      {/* Status Messages */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-2">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          {success}
        </div>
      )}
    </div>
  );
}
