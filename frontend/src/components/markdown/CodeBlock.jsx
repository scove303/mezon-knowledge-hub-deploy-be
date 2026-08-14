'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useToastStore } from '@/stores/toast';

export default function CodeBlock({ className, children, ...props }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = String(children ?? '').replace(/\n$/, '');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      useToastStore.getState().addToast('Đã copy code vào clipboard!', 'success');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      useToastStore.getState().addToast('Không thể copy code', 'error');
    }
  };

  return (
    <div className="relative group/code">
      <pre className="bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded-lg p-4 my-4 overflow-x-auto text-xs font-mono text-[rgb(var(--color-text-secondary))] shadow-inner">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-indigo-400 hover:border-indigo-500/40 opacity-0 group-hover/code:opacity-100 transition-all"
        title="Copy code"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}