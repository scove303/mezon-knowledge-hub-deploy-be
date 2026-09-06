'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Bot, User, FolderOpen, Plus, Network, Paperclip } from 'lucide-react';
import Greeting from '@/components/chat/Greeting';
import ChatInput from '@/components/chat/ChatInput';
import StreamingText from '@/components/chat/StreamingText';
import DashboardStats from '@/components/dashboard/DashboardStats';
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

interface ChatThread {
  id: string;
  jobId: string | null;
  topic: string;
  fileName?: string;
  status: 'submitting' | 'queued' | 'running' | 'done' | 'error';
  statusMessage: string;
  total: number;
  output: string;
  folderId: string | null;
  folderName: string;
  conversationId: string | null;
  action: 'roadmap' | 'followup' | 'digest' | 'youtube';
  error: string;
}



export default function DashboardIndex() {
  const router = useRouter();
  const { setFolders, setSelectedFile, setDocumentSideOpen } = useWorkspaceStore() as any;

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
      if (res.success) {
        setFolders(res.data);
        return res.data;
      }
    } catch (err) {
      console.error('Lỗi refresh folder sidebar:', err);
    }
    return null;
  }, [setFolders]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threads]);

  const extractYoutubeUrl = (text: string): string | null => {
    if (!text) return null;
    const match = text.match(/(https?:\/\/)?((?:www\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=|shorts\/)|youtu\.be\/)[\w-]+[^\s]*)/i);
    if (match) {
      const full = match[0].replace(/[.,!?;:]+$/, '');
      return full.startsWith('http://') || full.startsWith('https://') ? full : `https://${full}`;
    }
    if (text.includes('youtube.com/') || text.includes('youtu.be/')) {
      const words = text.trim().split(/\s+/);
      const urlWord = words.find((w) => w.includes('youtube.com/') || w.includes('youtu.be/'));
      if (urlWord) {
        const cleaned = urlWord.replace(/[.,!?;:]+$/, '');
        return cleaned.startsWith('http://') || cleaned.startsWith('https://') ? cleaned : `https://${cleaned}`;
      }
    }
    return null;
  };

  const isYoutubeUrl = (text: string) => {
    return !!extractYoutubeUrl(text);
  };

  const getLastConversation = useCallback((): ChatThread | null => {
    const doneThreads = threads.filter((t) => t.status === 'done' && t.folderId);
    return doneThreads.length > 0 ? doneThreads[doneThreads.length - 1] : null;
  }, [threads]);

  const handleSubmit = async (message: string, file?: File | null) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const threadId = `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const folderName = `${message.slice(0, 30)}${message.length > 30 ? '...' : ''}`;

    // Nếu có file đính kèm → gửi qua endpoint /ai/digest
    if (file) {
      const topicDisplay = message.trim() || `Tài liệu: ${file.name}`;
      setThreads((prev) => [
        ...prev,
        {
          id: threadId,
          jobId: null,
          topic: topicDisplay,
          fileName: file.name,
          status: 'running',
          statusMessage: `Đang đọc, tóm tắt và xử lý tài liệu "${file.name}"...`,
          total: 0,
          output: '',
          folderId: null,
          folderName: file.name,
          conversationId: null,
          action: 'digest',
          error: '',
        },
      ]);

      try {
        const digestRes = await aiService.digestDocument(file, undefined, message.trim() || undefined);
        const folderId = digestRes?.data?.folder_id;
        const suggestedName = digestRes?.data?.suggested_folder_name || file.name;
        const docs = digestRes?.data?.documents_created || [];

        updateThread(threadId, {
          status: 'done',
          folderId,
          folderName: suggestedName,
          statusMessage: 'Hoàn tất!',
          output: `Đã xử lý xong tài liệu **${file.name}** thành công và lưu ${docs.length} tài liệu vào thư mục **${suggestedName}**.`,
        });

        const newFolders = await refreshSidebarFolders();
        if (newFolders && folderId) {
          const newFolder = newFolders.find((f: any) => String(f.id) === String(folderId));
          if (newFolder && newFolder.files && newFolder.files.length > 0) {
            setSelectedFile(newFolder.files[0].id);
            setDocumentSideOpen(true);
            router.push(`/dashboard/folders/${folderId}`);
          }
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          err?.message ||
          'Không thể xử lý tài liệu. Vui lòng thử lại sau!';
        updateThread(threadId, { status: 'error', error: msg, statusMessage: 'Thất bại' });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Nếu là link video YouTube → gửi qua endpoint /ai/youtube
    if (isYoutubeUrl(message)) {
      const youtubeUrl = extractYoutubeUrl(message) || message.trim();
      const lastConversation = getLastConversation();
      const targetFolderId = lastConversation?.folderId || undefined;

      setThreads((prev) => [
        ...prev,
        {
          id: threadId,
          jobId: null,
          topic: message,
          status: 'running',
          statusMessage: 'Đang kết nối và gửi link YouTube đến hệ thống...',
          total: 0,
          output: '',
          folderId: targetFolderId || null,
          folderName: targetFolderId ? lastConversation?.folderName || 'YouTube Summary' : 'Lộ trình từ YouTube',
          conversationId: targetFolderId || null,
          action: 'youtube',
          error: '',
        },
      ]);

      try {
        const prevFolders = await refreshSidebarFolders();
        const existingIds = new Set((prevFolders || []).map((f: any) => String(f.id)));

        const res = await aiService.summarizeYoutube(youtubeUrl, targetFolderId);
        if (!res?.success) {
          throw new Error(res?.message || 'Không thể xử lý video YouTube. Vui lòng thử lại!');
        }

        updateThread(threadId, {
          status: 'running',
          statusMessage: 'Đang phân tích video và tạo nội dung bài học...',
        });

        // Polling để cập nhật sidebar và chuyển hướng khi xử lý xong
        let createdFolder: any = null;
        const maxAttempts = 30; // 30 x 2s = 60s
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const updatedFolders = await refreshSidebarFolders();
          if (updatedFolders && Array.isArray(updatedFolders)) {
            if (targetFolderId) {
              const target = updatedFolders.find((f: any) => String(f.id) === String(targetFolderId));
              const prevTarget = prevFolders?.find((f: any) => String(f.id) === String(targetFolderId));
              if (target && target.files && (!prevTarget || target.files.length > (prevTarget.files?.length || 0))) {
                createdFolder = target;
                break;
              }
            } else {
              const found = updatedFolders.find((f: any) => !existingIds.has(String(f.id)));
              if (found) {
                createdFolder = found;
                break;
              }
            }
          }
        }

        if (createdFolder) {
          const fileCount = createdFolder.files?.length || 0;
          updateThread(threadId, {
            status: 'done',
            folderId: createdFolder.id,
            folderName: createdFolder.name,
            statusMessage: 'Hoàn tất!',
            output: `Đã phân tích video YouTube thành công và tạo lộ trình **${createdFolder.name}**${fileCount > 0 ? ` với ${fileCount} bài học.` : '.'}`,
          });

          if (createdFolder.files && createdFolder.files.length > 0) {
            setSelectedFile(createdFolder.files[0].id);
            setDocumentSideOpen(true);
            router.push(`/dashboard/folders/${createdFolder.id}`);
          }
        } else {
          await refreshSidebarFolders();
          updateThread(threadId, {
            status: 'done',
            statusMessage: 'Đang tiếp tục xử lý trong nền',
            output: 'Yêu cầu phân tích video YouTube đã được tiếp nhận và đang tiếp tục xử lý trong nền. Vui lòng kiểm tra danh sách thư mục sau vài giây!',
          });
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          err?.message ||
          'Không thể xử lý video YouTube. Vui lòng thử lại sau!';
        updateThread(threadId, { status: 'error', error: msg, statusMessage: 'Thất bại' });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Nếu có thread hoàn thành gần nhất (có folder) → đây là prompt hỏi tiếp / chỉnh sửa,
    // giữ nguyên conversation_id = folder_id cũ thay vì tạo lộ trình mới.
    const lastConversation = getLastConversation();
    const isFollowUp = !!lastConversation;

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
        folderId: isFollowUp ? lastConversation.folderId : null,
        folderName,
        conversationId: isFollowUp ? lastConversation.folderId : null,
        action: isFollowUp ? 'followup' : 'roadmap',
        error: '',
      },
    ]);

    try {
      if (isFollowUp) {
        // ---------- PROMPT HỎI TIẾP / CHỈNH SỬA ----------
        const followUpRes = await aiService.followUpRoadmap(
          lastConversation.folderId,
          message,
          lastConversation.folderName,
        );
        const jobId = followUpRes?.data?.job_id;
        if (!jobId) throw new Error('Backend không trả về job_id');

        updateThread(threadId, { jobId, status: 'queued', statusMessage: 'Đã nhận yêu cầu, đang chuẩn bị...' });

        await aiService.streamFollowUp(jobId, {
          onStatus: (msg: string) => updateThread(threadId, { statusMessage: msg }),
          onAnswer: (text: string) => updateThread(threadId, {
            status: 'running',
            statusMessage: 'Đang hoàn tất câu trả lời...',
            output: text,
          }),
          onEdit: (evt: any) => updateThread(threadId, {
            status: 'running',
            statusMessage: `Đang chỉnh sửa bài "${evt.title}"...`,
            output: `### ✏️ Đã chỉnh sửa bài học: **${evt.title}**\n\n${evt.content}`,
          }),
          onCreateSubfolder: async (evt: any) => {
            updateThread(threadId, {
              status: 'done',
              statusMessage: 'Hoàn tất!',
              output: `### 📁 Đã tạo thư mục con: **${evt.subfolder_name}**`,
              folderId: evt.subfolder_id || lastConversation.folderId,
              folderName: evt.subfolder_name || lastConversation.folderName,
            });
            await refreshSidebarFolders();
            if (evt.subfolder_id) {
              router.push(`/dashboard/folders/${evt.subfolder_id}`);
            }
          },
          onDone: async (evt: any) => {
            updateThread(threadId, {
              status: 'done',
              statusMessage: evt.action === 'edit' ? 'Đã cập nhật bài học!' : 'Hoàn tất!',
              folderId: evt.folder_id || lastConversation.folderId,
              folderName: lastConversation.folderName,
            });
            if (evt.action === 'edit') await refreshSidebarFolders();
          },
          onError: (msg: string) => updateThread(threadId, { status: 'error', error: msg, statusMessage: 'Thất bại' }),
        });
      } else {
        // ---------- TẠO LỘ TRÌNH MỚI ----------
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
            const newFolders = await refreshSidebarFolders();
            if (newFolders && evt.folder_id) {
               const newFolder = newFolders.find((f: any) => String(f.id) === String(evt.folder_id));
               if (newFolder && newFolder.files && newFolder.files.length > 0) {
                 setSelectedFile(newFolder.files[0].id);
                 setDocumentSideOpen(true);
                 // Move to the folder page to view it
                 router.push(`/dashboard/folders/${evt.folder_id}`);
               }
            }
          },
          onError: (msg: string) => updateThread(threadId, { status: 'error', error: msg, statusMessage: 'Thất bại' }),
        });
      }
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
          {threads.length === 0 && <DashboardStats />}

          {threads.length > 0 && (
            <div className="flex justify-end pb-2">
              <button
                onClick={() => setThreads([])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[rgb(var(--color-text-muted))] border border-[rgb(var(--color-border))] hover:text-indigo-400 hover:border-indigo-500/40 transition-colors"
              >
                <Plus size={14} />
                Hội thoại mới
              </button>
            </div>
          )}

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
                      <div className="bg-indigo-600/15 border border-indigo-500/20 text-[rgb(var(--color-text-primary))] rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-wrap text-sm leading-relaxed flex flex-col gap-1.5">
                        {thread.fileName && (
                          <div className="inline-flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20 self-start">
                            <Paperclip size={12} />
                            <span>{thread.fileName}</span>
                          </div>
                        )}
                        <span>{thread.topic}</span>
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
                          {thread.folderId && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openFolder(thread.folderId!)}
                                className="self-start flex items-center gap-2 px-4 py-2 mt-1 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-500/20"
                              >
                                <FolderOpen size={16} />
                                {thread.action === 'digest' ? 'Mở thư mục' : 'Mở lộ trình'}
                              </button>
                              <button
                                onClick={() =>
                                  router.push(`/dashboard/folders/${thread.folderId}?view=mindmap`)
                                }
                                className="self-start flex items-center gap-2 px-4 py-2 mt-1 rounded-lg text-sm font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:text-indigo-400 hover:border-indigo-500/40 transition-colors"
                              >
                                <Network size={16} />
                                Xem sơ đồ tư duy
                              </button>
                            </div>
                          )}
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
              placeholder={currentText.dashboard.chat.placeholder}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
