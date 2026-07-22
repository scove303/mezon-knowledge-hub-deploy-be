import React from "react";
import { User, Bot, Paperclip } from "lucide-react";

export interface MessageProps {
  id: string;
  role: "user" | "bot";
  content: string;
  fileAttachment?: string;
  isStatus?: boolean;
}

export default function ChatMessage({ message }: { message: MessageProps }) {
  const isUser = message.role === "user";

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
        <div className="font-semibold text-sm text-[rgb(var(--color-text-primary))]">
          {isUser ? "You" : "AI-KHB"}
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

        <div
          className={`text-[rgb(var(--color-text-primary))] leading-relaxed whitespace-pre-wrap ${message.isStatus ? "italic text-[rgb(var(--color-text-muted))]" : ""}`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
