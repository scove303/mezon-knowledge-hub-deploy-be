import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSubmit: (message: string, file?: File | null) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSubmit, isLoading, placeholder = "Message AI-KHB..." }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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
      setMessage('');
      setFile(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className={`relative w-full max-w-3xl mx-auto flex flex-col bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all duration-300 ${
        isLoading ? 'glowing-border-active shadow-lg shadow-indigo-500/5' : ''
      }`}
    >
      {file && (
        <div className="px-4 pt-3 flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[rgb(var(--color-surface-2))] px-3 py-1.5 rounded-md text-sm border border-[rgb(var(--color-border))]">
            <Paperclip size={14} className="text-indigo-400" />
            <span className="truncate max-w-[200px] text-[rgb(var(--color-text-primary))]">{file.name}</span>
            <button 
              type="button" 
              onClick={() => !isLoading && setFile(null)}
              disabled={isLoading}
              className={`ml-1 text-[rgb(var(--color-text-muted))] hover:text-red-500 transition-colors ${
                isLoading ? 'cursor-not-allowed opacity-50' : ''
              }`}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      <div className="flex items-end px-2 pb-2 pt-2 gap-2">
        <label 
          className={`p-2 mb-1 cursor-pointer text-[rgb(var(--color-text-muted))] hover:text-indigo-400 transition-colors rounded-full hover:bg-[rgb(var(--color-surface-2))] ${
            isLoading ? 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-[rgb(var(--color-text-muted))]' : ''
          }`}
        >
          <Paperclip size={20} />
          <input 
            type="file" 
            className="hidden" 
            disabled={isLoading}
            onChange={(e) => !isLoading && setFile(e.target.files?.[0] || null)}
            accept=".pdf,.docx,.txt"
          />
        </label>
        
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => !isLoading && setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? "AI-KHB is thinking..." : placeholder}
          disabled={isLoading}
          className={`flex-1 max-h-[200px] bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] outline-none min-h-[44px] ${
            isLoading ? 'cursor-not-allowed opacity-50' : ''
          }`}
          rows={1}
        />

        <button
          type="submit"
          disabled={isLoading || (!message.trim() && !file)}
          className={`p-2 mb-1 mr-1 rounded-full transition-all duration-300 flex items-center justify-center
            ${(message.trim() || file) && !isLoading
              ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md hover:scale-105' 
              : 'bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] cursor-not-allowed'
            } ${isLoading ? 'bg-indigo-600/20 text-indigo-400' : ''}`}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </form>
  );
}
