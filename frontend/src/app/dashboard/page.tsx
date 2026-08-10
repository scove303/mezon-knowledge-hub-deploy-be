'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Bot, User, FolderOpen } from 'lucide-react';
import Greeting from '@/components/chat/Greeting';
import ChatInput from '@/components/chat/ChatInput';
import StreamingText from '@/components/chat/StreamingText';
import { useWorkspaceStore } from '@/features/folders/store';
import { folderService } from '@/features/folders/services';
import { aiService } from '@/features/ai/services';
import { useAuthStore } from '@/features/auth/store';
import { useLanguage } from '@/localization/LanguageContext';
import vn from "@/localization/languages/vn.json";
import en from "@/localization/languages/en.json";

const translation = {
  en: en,
  vn: vn
}

function GuestBanner() {
  const isAuthenticated = useAuthStore((s: any) => s.isAuthenticated);
  if (isAuthenticated) return null;
  return (
    <div className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
      <span>Bạn đang dùng chế độ Khách. Dữ liệu sẽ được tự động chuyển sang tài khoản khi bạn</span>
      <Link href="/login" className="font-semibold underline hover:text-indigo-200">
        đăng nhập
      </Link>
      .
    </div>
  );
}

interface ChatThread {
  id: string;
  jobId: string | null;
  topic: string;
  status: 'submitting' | 'queued' | 'running' | 'done' | 'error';
  statusMessage: string;
  total: number;
  output: string;
  folderId: string | null;
  folderName: string;
  error: string;
}



export default function DashboardIndex() {
  const router = useRouter();
  const { setFolders } = useWorkspaceStore() as any;

  const {currentLanguage, setCurrentLanguage} = useLanguage();
  const currentText = translation[currentLanguage];
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const updateThread = useCallback(
    (id: string, patch: Partial<ChatThread> | ((t: ChatThread) => Partial<ChatThread>)) => {
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)),
      );
    },
    [],
  );

  const refreshSidebarFolders = useCallback(async () => {
    try {
      const res = await folderService.getFolders();
      if (res.success) setFolders(res.data);
    } catch (err) {
      console.error('Lỗi refresh folder sidebar:', err);
    }
  }, [setFolders]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threads]);

  const isYoutubeUrl = (text: string) => {
    return text.includes('youtube.com/') || text.includes('youtu.be/');
  };

  const handleSubmit = async (message: string, file?: File | null) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const threadId = `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const folderName = `🐍 Lộ trình: ${message.slice(0, 20)}${message.length > 20 ? '...' : ''}`;

    setThreads((prev) => [
      ...prev,
      {
        id: threadId,
        jobId: null,
        topic: message,
        status: 'submitting',
        statusMessage: 'Đang gửi yêu cầu...',
        total: 0,
        output: '',
        folderId: null,
        folderName,
        error: '',
      },
    ]);

    try {
      const roadmapRes = await aiService.generateRoadmap(message, folderName);
      const jobId = roadmapRes?.data?.job_id;
      if (!jobId) throw new Error('Backend không trả về job_id');

      updateThread(threadId, { jobId, status: 'queued', statusMessage: 'Đã nhận yêu cầu, đang chuẩn bị...' });

      await aiService.streamRoadmap(jobId, {
        onStatus: (msg: string) => updateThread(threadId, { statusMessage: msg }),
        onOutline: (total: number) => updateThread(threadId, { total }),
        onLesson: (evt: any) => {
          const title = evt.title || `Bài ${evt.idx}`;
          const content = evt.content || '';
          updateThread(threadId, (t: any) => ({
            status: 'running',
            statusMessage: `Đang soạn bài ${evt.idx}/${evt.total}...`,
            output: `${t.output}\n\n## ${title}\n\n${content}`,
          }));
        },
        onDone: async (evt: any) => {
          updateThread(threadId, {
            status: 'done',
            folderId: evt.folder_id,
            folderName: evt.folder_name || folderName,
            statusMessage: 'Hoàn tất!',
            output: `Đã tạo xong lộ trình với ${evt.total_files} bài học.`,
          });
          await refreshSidebarFolders();
        },
        onError: (msg: string) => updateThread(threadId, { status: 'error', error: msg, statusMessage: 'Thất bại' }),
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Không thể kết nối với dịch vụ AI. Vui lòng thử lại sau!';
      updateThread(threadId, { status: 'error', error: msg, statusMessage: 'Thất bại' });
      if (err?.message?.includes('404')) {
        updateThread(threadId, { error: 'Job không còn tồn tại (server đã khởi động lại). Vui lòng thử lại.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openFolder = (folderId: string) => {
    router.push(`/dashboard/folders/${folderId}`);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto">
      <div className="flex flex-col items-center justify-start h-full w-full p-4 md:p-8">
        <div className="w-full max-w-4xl flex flex-col flex-1 min-h-0">
          <GuestBanner />

          {threads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-8 py-8">
              <Greeting />
            </div>
          ) : (
            <div className="flex-1 space-y-4 py-6 overflow-y-auto scrollbar-thin">
              {threads.map((thread) => (
                <div key={thread.id} className="space-y-4">
                  {/* User bubble */}
                  <div className="flex gap-4 p-4 rounded-xl justify-end">
                    <div className="flex flex-col gap-2 flex-1 max-w-[80%] items-end">
                      <div className="font-semibold text-sm text-[rgb(var(--color-text-primary))]">You</div>
                      <div className="bg-indigo-600/15 border border-indigo-500/20 text-[rgb(var(--color-text-primary))] rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-wrap text-sm leading-relaxed">
                        {thread.topic}
                      </div>
                    </div>
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shadow-sm">
                        <User size={16} className="text-indigo-400" />
                      </div>
                    </div>
                  </div>

                  {/* Bot bubble */}
                  <div className="flex gap-4 p-4 rounded-xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))]">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shadow-sm">
                        <Bot size={16} className="text-purple-400" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      <div className="font-semibold text-sm text-[rgb(var(--color-text-primary))]">AI-KHB</div>

                      {(thread.status === 'queued' || thread.status === 'running' || thread.status === 'submitting') && (
                        <div className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-secondary))]">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                          <span>{thread.statusMessage}</span>
                          {thread.total > 0 && thread.status === 'running' && (
                            <span className="text-xs text-[rgb(var(--color-text-muted))]">
                              (bài hoàn thành: {(thread.output.match(/^## /gm) || []).length}/{thread.total})
                            </span>
                          )}
                        </div>
                      )}

                      {thread.status === 'running' && thread.output && (
                        <StreamingText
                          text={thread.output}
                          active
                          className="text-sm text-[rgb(var(--color-text-primary))] leading-relaxed max-h-[420px] overflow-y-auto scrollbar-thin"
                        />
                      )}

                      {thread.status === 'done' && (
                        <>
                          <StreamingText
                            text={thread.output}
                            active={false}
                            className="text-sm text-[rgb(var(--color-text-primary))] leading-relaxed"
                          />
                          <button
                            onClick={() => thread.folderId && openFolder(thread.folderId)}
                            className="self-start flex items-center gap-2 px-4 py-2 mt-1 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-500/20"
                          >
                            <FolderOpen size={16} />
                            Mở lộ trình
                          </button>
                        </>
                      )}

                      {thread.status === 'error' && (
                        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 whitespace-pre-wrap">
                          {thread.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} className="h-2" />
            </div>
          )}

          <div className="pb-4 pt-2">
            <ChatInput
              onSubmit={handleSubmit}
              isLoading={isSubmitting}
              placeholder="Ask a question, paste a YouTube link, or upload a document..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
