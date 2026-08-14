'use client';

export const MarkdownComponents = {
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2"
      {...props}
    >
      {children}
    </a>
  ),
  h1: ({ children }) => (
    <h1 className="text-2xl font-extrabold text-[rgb(var(--color-text-primary))] mt-6 mb-4 pb-2 border-b border-[rgb(var(--color-border))]">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-[rgb(var(--color-text-secondary))] mt-6 mb-3">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-bold text-[rgb(var(--color-text-secondary))] mt-4 mb-2">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 my-3 space-y-1.5 text-[rgb(var(--color-text-secondary))]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 my-3 space-y-1.5 text-[rgb(var(--color-text-secondary))]">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }) => (
    <div className="border-l-4 border-indigo-500 bg-[rgb(var(--color-surface-1))]/60 rounded-r-lg px-4 py-3 my-4 italic text-[rgb(var(--color-text-secondary))] text-sm">
      {children}
    </div>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-6 rounded-lg border border-[rgb(var(--color-border))]">
      <table className="w-full text-left border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[rgb(var(--color-surface-1))] text-xs font-semibold text-[rgb(var(--color-text-muted))] border-b border-[rgb(var(--color-border))]">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-[rgb(var(--color-border))] text-sm">
      {children}
    </tbody>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-[rgb(var(--color-surface-1))]/30 transition-colors">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-3 font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-[rgb(var(--color-text-secondary))]">
      {children}
    </td>
  ),
  code: ({ inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <pre className="bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded-lg p-4 my-4 overflow-x-auto text-xs font-mono text-[rgb(var(--color-text-secondary))] shadow-inner">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    ) : (
      <code
        className="px-1.5 py-0.5 rounded bg-[rgb(var(--color-surface-1))] text-indigo-400 text-xs font-mono font-medium border border-[rgb(var(--color-border))]"
        {...props}
      >
        {children}
      </code>
    );
  },
};