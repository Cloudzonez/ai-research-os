import React, { useState, useCallback } from "react";
import { X } from "lucide-react";

export const ToastContext = React.createContext({});

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }, []);

  const removeToast = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), []);

  const colors = {
    success: "border-emerald-500/20 bg-white dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300",
    error: "border-red-500/20 bg-white dark:bg-red-950/80 text-red-700 dark:text-red-300",
    info: "border-blue-500/20 bg-white dark:bg-blue-950/80 text-blue-700 dark:text-blue-300",
  };

  return (
    <ToastContext.Provider value={{ addToast, toasts, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`flex items-center gap-3 min-w-[280px] rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl animate-slide-up ${colors[toast.type] || colors.info}`}>
            <span className="flex-1">{toast.message}</span>
            <button className="shrink-0 opacity-60 hover:opacity-100" onClick={() => removeToast(toast.id)} type="button">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
