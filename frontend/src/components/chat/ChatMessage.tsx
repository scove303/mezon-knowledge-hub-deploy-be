import React, { useState } from "react";
import { User, Bot, Paperclip, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToastStore } from "@/stores/toast";

export interface MessageProps {
  id: string;
  role: "user" | "bot";
  content: string;
  fileAttachment?: string;
  isStatus?: boolean;
}

// Style markdown gọn nhẹ, theo theme của app (tương tự FileViewer)
const MarkdownComponents = {
  a: ({ href, children, ...props }: any) => (
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
  h1: ({ children }: any) => (
    <h1 className="text-base font-bold text-[rgb(var(--color-text-primary))] mt-3 mb-2 pb-1 border-b border-[rgb(var(--color-border))] first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-[15px] font-bold text-[rgb(var(--color-text-primary))] mt-3 mb-1.5 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-sm font-bold text-[rgb(var(--color-text-secondary))] mt-2 mb-1 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }: any) => (
    <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc pl-5 my-1.5 space-y-1">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal pl-5 my-1.5 space-y-1">{children}</ol>
  ),
  li: ({ children }: any) => (
    <li className="leading-relaxed marker:text-[rgb(var(--color-text-muted))]">
      {children}
    </li>
  ),
  blockquote: ({ children }: any) => (
    <div className="border-l-2 border-indigo-500/60 bg-[rgb(var(--color-surface-2))]/50 rounded-r-md px-3 py-2 my-2 text-[rgb(var(--color-text-secondary))] text-sm">
      {children}
    </div>
  ),
  code: ({ inline, children, ...props }: any) =>
    inline ? (
      <code
        className="px-1.5 py-0.5 rounded bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-primary))] text-[0.85em] font-mono"
        {...props}
      >
        {children}
      </code>
    ) : (
      <code
        className="block bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] rounded-lg px-3 py-2.5 my-2 overflow-x-auto text-[0.85em] font-mono text-[rgb(var(--color-text-primary))]"
        {...props}
      >
        {children}
      </code>
    ),
  pre: ({ children }: any) => (
    <pre className="my-2">{children}</pre>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-2))] px-2.5 py-1.5 text-left font-semibold text-[rgb(var(--color-text-primary))]">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="border border-[rgb(var(--color-border))] px-2.5 py-1.5 text-[rgb(var(--color-text-secondary))]">
      {children}
    </td>
  ),
  hr: () => (
    <hr className="my-3 border-[rgb(var(--color-border))]" />
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-[rgb(var(--color-text-primary))]">
      {children}
    </strong>
  ),
};

export default function ChatMessage({ message }: { message: MessageProps }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      useToastStore.getState().addToast("Đã copy nội dung vào clipboard!", "success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      useToastStore.getState().addToast("Không thể copy nội dung", "error");
    }
  };

  return (
    <div
      className={`flex gap-4 p-4 rounded-xl ${isUser ? "" : "bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))]"}`}
    >
      <div className="flex-shrink-0 mt-1">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shadow-sm">
            <User size={16} className="text-indigo-400" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shadow-sm">
            <Bot size={16} className="text-purple-400" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-sm text-[rgb(var(--color-text-primary))]">
            {isUser ? "You" : "AI-KHB"}
          </div>
          {!isUser && !message.isStatus && (
            <button
              onClick={handleCopy}
              className="p-1 rounded transition-colors text-[rgb(var(--color-text-muted))] hover:text-indigo-400 hover:bg-[rgb(var(--color-surface-2))]"
              title="Copy nội dung"
              aria-label="Copy nội dung"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          )}
        </div>

        {message.fileAttachment && (
          <div className="flex items-center gap-2 bg-[rgb(var(--color-surface-2))] px-3 py-2 rounded-md text-sm border border-[rgb(var(--color-border))] w-fit">
            <Paperclip
              size={14}
              className="text-[rgb(var(--color-text-muted))]"
            />
            <span className="truncate max-w-[200px] text-[rgb(var(--color-text-primary))]">
              {message.fileAttachment}
            </span>
          </div>
        )}

        {message.isStatus ? (
          <div className="italic text-[rgb(var(--color-text-muted))] leading-relaxed text-sm">
            {message.content}
          </div>
        ) : (
          <div className="text-[rgb(var(--color-text-primary))] leading-relaxed text-sm [&_*]:break-words">
            {isUser ? (
              <span className="whitespace-pre-wrap">{message.content}</span>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={MarkdownComponents}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
