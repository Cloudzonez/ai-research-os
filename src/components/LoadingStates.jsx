import React from "react";

export function Skeleton({ className = "", lines = 3 }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3.5 rounded-md bg-gray-200 dark:bg-white/5" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="surface animate-pulse p-5">
      <div className="h-4 w-2/3 rounded-md bg-gray-200 dark:bg-white/5 mb-3" />
      <Skeleton lines={2} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      {Icon && <Icon className="h-10 w-10 text-muted mb-4" />}
      <p className="text-sm font-medium text-dull mb-1">{title}</p>
      {hint && <p className="text-xs text-muted max-w-sm mb-4">{hint}</p>}
      {action && onAction && <button className="btn-primary" type="button" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function ErrorDisplay({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-4">
        <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm text-red-600 dark:text-red-400 mb-3">{message}</p>
      {onRetry && <button className="btn-secondary" type="button" onClick={onRetry}>Retry</button>}
    </div>
  );
}
