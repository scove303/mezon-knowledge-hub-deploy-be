import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X, Mic } from "lucide-react";
import BorderBeam from "@/components/ui/border-beam";
import { useThemeStore } from "@/store/useThemeStore";
import type { ThemeMode } from "@/types/theme";
import type { BorderBeamColorVariant } from "border-beam";

interface ChatInputProps {
  onSubmit: (message: string, file?: File | null) => void;
  isLoading?: boolean;
  placeholder?: string;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

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
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const interimRef = useRef("");
  const listenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theme = useThemeStore((s) => s.theme);

  const getRecognition = (): SpeechRecognitionLike | null => {
    if (recognitionRef.current) return recognitionRef.current;
    if (typeof window === "undefined") return null;
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return null;
    const rec: SpeechRecognitionLike = new Ctor();
    rec.lang = "vi-VN";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setMessage((prev) => {
        const base =
          interimRef.current && prev.endsWith(interimRef.current)
            ? prev.slice(0, -interimRef.current.length)
            : prev;
        interimRef.current = text;
        return base + text;
      });
    };
    rec.onend = () => {
      interimRef.current = "";
      if (listenTimerRef.current) {
        clearTimeout(listenTimerRef.current);
        listenTimerRef.current = null;
      }
      setIsListening(false);
    };
    rec.onerror = (e) => {
      interimRef.current = "";
      setIsListening(false);
      if (e.error === "not-allowed") {
        setMicError("Chưa được cấp quyền truy cập micro");
      } else if (e.error !== "aborted" && e.error !== "no-speech") {
        setMicError("Không thể nhận diện giọng nói, hãy thử lại");
      }
    };
    recognitionRef.current = rec;
    return rec;
  };

  useEffect(() => {
    return () => {
      if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const toggleListening = () => {
    const rec = getRecognition();
    if (!rec) {
      setMicError("Trình duyệt không hỗ trợ nhập bằng giọng nói");
      return;
    }
    setMicError(null);
    if (isListening) {
      rec.stop();
      return;
    }
    try {
      interimRef.current = "";
      rec.start();
      setIsListening(true);
      if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
      listenTimerRef.current = setTimeout(() => {
        listenTimerRef.current = null;
        rec.stop();
      }, 30000);
    } catch {
      setMicError("Không thể khởi động micro");
    }
  };

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
        {micError && (
          <div className="px-4 pb-1 -mt-1 text-[11px] text-red-400">
            {micError}
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

          <button
              type="button"
              onClick={toggleListening}
              disabled={isLoading}
              aria-label={isListening ? "Dừng ghi âm" : "Nhập bằng giọng nói"}
              title={isListening ? "Đang nghe... (bấm để dừng)" : "Nhập bằng giọng nói"}
              className={`p-2 mb-1 mr-0.5 rounded-full transition-colors flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0
                ${
                  isListening
                    ? "bg-red-500/15 text-red-400 animate-pulse"
                    : "text-[rgb(var(--color-text-muted))] hover:text-indigo-400 hover:bg-[rgb(var(--color-surface-2))]"
                }`}
            >
              <Mic size={18} />
            </button>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Đang nghe..." : placeholder}
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