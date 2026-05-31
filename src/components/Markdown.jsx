import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function Markdown({ children, className = "" }) {
  if (!children) return null;

  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-lg font-bold text-main mt-3 mb-1" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-base font-semibold text-main mt-2.5 mb-1" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-sm font-semibold text-main mt-2 mb-0.5" {...props} />,
          h4: ({ node, ...props }) => <h4 className="text-sm font-medium text-dull mt-1.5 mb-0.5" {...props} />,
          p: ({ node, ...props }) => <p className="text-sm leading-relaxed mb-1.5 last:mb-0" {...props} />,
          a: ({ node, ...props }) => (
            <a className="text-emerald-600 dark:text-emerald-400 underline hover:no-underline" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 text-sm mb-1.5 space-y-0.5" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 text-sm mb-1.5 space-y-0.5" {...props} />,
          li: ({ node, ...props }) => <li className="text-dull" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-3 border-gray-300 dark:border-zinc-600 pl-3 text-sm text-muted italic my-1.5" {...props} />
          ),
          code: ({ node, inline, className: codeClass, children: codeChildren, ...props }) => {
            if (inline) {
              return (
                <code className="bg-gray-100 dark:bg-zinc-800 text-rose-600 dark:text-rose-400 text-xs px-1.5 py-0.5 rounded font-mono" {...props}>
                  {codeChildren}
                </code>
              );
            }
            return (
              <pre className="bg-gray-900 dark:bg-zinc-800 text-gray-100 text-xs rounded-lg p-3 overflow-x-auto my-2">
                <code className={codeClass} {...props}>{codeChildren}</code>
              </pre>
            );
          },
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-sm border-collapse" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-gray-50 dark:bg-zinc-800" {...props} />,
          th: ({ node, ...props }) => <th className="border border-gray-200 dark:border-zinc-700 px-3 py-1.5 text-left text-xs font-semibold text-main" {...props} />,
          td: ({ node, ...props }) => <td className="border border-gray-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-dull" {...props} />,
          hr: ({ node, ...props }) => <hr className="my-3 border-gray-200 dark:border-zinc-700" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-semibold text-main" {...props} />,
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          del: ({ node, ...props }) => <del className="line-through text-muted" {...props} />,
          img: ({ node, ...props }) => <img className="max-w-full rounded-lg my-2" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
