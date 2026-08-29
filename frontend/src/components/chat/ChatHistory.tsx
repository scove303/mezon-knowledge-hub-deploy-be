import React, { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import ChatMessage, { MessageProps } from './ChatMessage';

interface ChatHistoryProps {
  messages: MessageProps[];
  isLoading?: boolean;
}

export default function ChatHistory({ messages, isLoading = false }: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-[rgb(var(--color-text-muted))] p-8 text-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p>Đang tải lịch sử chat...</p>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-[rgb(var(--color-text-muted))] p-8 text-center gap-4">
        <p>No messages in this chat yet.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-4 md:p-6 scrollbar-thin">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
