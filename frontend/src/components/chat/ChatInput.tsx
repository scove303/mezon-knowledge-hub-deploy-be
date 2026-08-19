import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X } from "lucide-react";
import BorderBeam from "@/components/ui/border-beam";
import { useThemeStore } from "@/store/useThemeStore";
import type { ThemeMode } from "@/types/theme";
import type { BorderBeamColorVariant } from "border-beam";

interface ChatInputProps {
  onSubmit: (message: string, file?: File | null) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const BEAM_VARIANT: Record<ThemeMode, BorderBeamColorVariant> = {
  light: "ocean",
  dark: "ocean",
  cisher: "ocean",
  "sunset-gradient": "sunset",
  "crimson-dark": "sunset",
};

// Không dùng theme="auto" (đọc prefers-color-scheme) → gây hydration mismatch
// giữa server (luôn sáng) và client (theo OS). Dùng theme từ store để khớp SSR.
const BEAM_THEME: Record<ThemeMode, "light" | "dark"> = {
  light: "light",
  dark: "dark",
  cisher: "dark",
  "sunset-gradient": "dark",
  "crimson-dark": "dark",
};

export default function ChatInput({
  onSubmit,
  isLoading,
  placeholder = "Message AI-KHB...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    handleInput();
  }, [message]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((message.trim() || file) && !isLoading) {
      onSubmit(message, file);
      setMessage("");
      setFile(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <BorderBeam
      size="md"
      colorVariant={BEAM_VARIANT[theme] ?? "ocean"}
      theme={BEAM_THEME[theme] ?? "light"}
      className="w-full max-w-3xl mx-auto"
      borderRadius={16}
    >
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-3xl mx-auto flex flex-col bg-[rgb(var(--color-surface-1))] rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/50 transition-shadow"
      >
        {file && (
          <div className="px-4 pt-3 flex items-center gap-2">
            <div className="flex items-center gap-2 bg-[rgb(var(--color-surface-2))] px-3 py-1.5 rounded-md text-sm border border-[rgb(var(--color-border))]">
              <Paperclip size={14} className="text-indigo-400" />
              <span className="truncate max-w-[200px] text-[rgb(var(--color-text-primary))]">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="ml-1 text-[rgb(var(--color-text-muted))] hover:text-red-500"
                aria-label="Bỏ đính kèm file"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
        <div className="flex items-end px-2 pb-2 pt-2 gap-2">
          <label className="p-2 mb-1 cursor-pointer text-[rgb(var(--color-text-muted))] hover:text-indigo-400 transition-colors rounded-full hover:bg-[rgb(var(--color-surface-2))] min-w-[44px] min-h-[44px] flex items-center justify-center md:min-w-0 md:min-h-0" aria-label="Đính kèm file">
            <Paperclip size={20} />
            <input
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              accept=".pdf,.docx,.txt"
            />
          </label>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 max-h-[200px] bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] outline-none min-h-[44px]"
            rows={1}
          />

          <button
            type="submit"
            disabled={isLoading || (!message.trim() && !file)}
            aria-label="Gửi tin nhắn"
            className={`p-2 mb-1 mr-1 rounded-full transition-colors flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0
              ${
                (message.trim() || file) && !isLoading
                  ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md"
                  : "bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] cursor-not-allowed"
              }`}
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </BorderBeam>
  );
}