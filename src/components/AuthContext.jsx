import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { api } from "../utils/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children, onTokenUsageUpdate }) {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Derived role helpers
  const isAdmin = useMemo(() => user?.role === "admin", [user]);
  const isTeacher = useMemo(() => user?.role === "teacher", [user]);
  const role = useMemo(() => user?.role || null, [user]);

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setAuthChecked(true);
      setLoading(false);
      return;
    }
    api.getMe()
      .then((data) => {
        setUser(data.user);
        if (onTokenUsageUpdate) {
          onTokenUsageUpdate({
            quota: data.user.quota || 1000000,
            used: data.user.quotaUsed || 0,
          });
        }
      })
      .catch(() => {
        localStorage.removeItem("auth_token");
      })
      .finally(() => {
        setAuthChecked(true);
        setLoading(false);
      });
  }, []);

  const login = useCallback(async (email, password) => {
    const result = await api.login(email, password);
    localStorage.setItem("auth_token", result.token);
    setUser(result.user);
    if (onTokenUsageUpdate) {
      onTokenUsageUpdate({
        quota: result.user.quota || 1000000,
        used: result.user.quotaUsed || 0,
      });
    }
    return result;
  }, [onTokenUsageUpdate]);

  const register = useCallback(async (email, password, name, role = "teacher") => {
    const result = await api.register(email, password, name, role);
    localStorage.setItem("auth_token", result.token);
    setUser(result.user);
    if (onTokenUsageUpdate) {
      onTokenUsageUpdate({
        quota: result.user.quota || 1000000,
        used: result.user.quotaUsed || 0,
      });
    }
    return result;
  }, [onTokenUsageUpdate]);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setUser(null);
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  // Listen for auth changes in other tabs
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "auth_token" && !e.newValue) {
        setUser(null);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const value = useMemo(() => ({
    user,
    isAdmin,
    isTeacher,
    role,
    authChecked,
    loading,
    login,
    register,
    logout,
    updateUser,
  }), [user, isAdmin, isTeacher, role, authChecked, loading, login, register, logout, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Higher-order component to restrict access by role.
 * Usage: <RequireRole role="admin"><AdminComponent /></RequireRole>
 */
export function RequireRole({ role, children, fallback = null }) {
  const { user } = useAuth();
  if (!user) return fallback;
  if (role && user.role !== role) return fallback;
  return children;
}

export default AuthContext;
