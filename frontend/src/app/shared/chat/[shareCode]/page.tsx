'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ExternalLink, FolderOpen, Eye, Download, Copy, Plus, Search, FileText } from 'lucide-react';
import { sharedChatService, type SharedChat, type SharedChatDetail } from '@/features/shared-chats/services';
import { useAuthStore } from '@/features/auth/store';
import { useToastStore } from '@/stores/toast';
import { useLanguage } from '@/localization/LanguageContext';
import vn from "@/localization/languages/vn.json";
import en from "@/localization/languages/en.json";

const translation = { en, vn };

export default function SharedChatPage({
  params,
}: {
  params: Promise<{ shareCode: string }> | { shareCode: string };
}) {
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const shareCode = resolvedParams.shareCode;
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const { currentLanguage } = useLanguage();
  const t = translation[currentLanguage];

  const [chat, setChat] = useState<SharedChatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadChat();
  }, [shareCode]);

  const loadChat = async () => {
    setLoading(true);
    try {
      const res = await sharedChatService.getSharedChat(shareCode);
      if (res && res.share_code) {
        setChat(res);
      } else {
        setNotFound(true);
        router.push('/dashboard/shared-chats/public');
      }
    } catch (err) {
      console.error('Load shared chat error:', err);
      setNotFound(true);
      router.push('/dashboard/shared-chats/public');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (newFolderName?: string) => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!chat) return;
    try {
      setImporting(true);
      const res = await sharedChatService.importChat(chat.share_code, newFolderName);
      if (res.success) {
        addToast(t.sharedChats?.importSuccess || 'Chat imported successfully!', 'success');
        router.push(`/dashboard/folders/${res.data.folder_id}`);
      } else {
        const errorMsg = res.message || res.detail?.message || 'Import failed';
        addToast(errorMsg, 'error');
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail?.message || err?.response?.data?.message || t.sharedChats?.importError || 'Import failed';
      addToast(errorMsg, 'error');
    } finally {
      setImporting(false);
      setShowImportDialog(false);
      setNewName('');
    }
  };

  const copyShareUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    addToast(t.sharedChats?.copied || 'Link copied!', 'success');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (notFound || !chat) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[rgb(var(--color-text-primary))] mb-4">
            {t.sharedChats?.notFound || 'Chat Not Found'}
          </h1>
          <p className="text-[rgb(var(--color-text-secondary))] mb-6 max-w-md">
            {t.sharedChats?.notFoundDesc || 'This shared chat does not exist or has expired.'}
          </p>
          <a
            href="/dashboard/shared-chats/public"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors"
          >
            <FolderOpen size={18} />
            {t.sharedChats?.browsePublic || 'Browse Public Chats'}
          </a>
        </div>
      </div>
    );
  }

  const totalFiles = chat.folder_snapshot?.files?.length || 0;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl md:text-3xl font-bold text-[rgb(var(--color-text-primary))]">
            {chat.title}
          </h1>
          <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-500/20 text-indigo-400">
            {chat.share_code}
          </span>
          {chat.is_public && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
              {t.sharedChats?.public || 'Public'}
            </span>
          )}
        </div>
        <p className="text-[rgb(var(--color-text-secondary))]">{chat.description || chat.topic}</p>
      </div>

      <div className="p-5 rounded-xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4 text-xs text-[rgb(var(--color-text-muted))] mb-4">
              <span className="flex items-center gap-1">👤 {chat.creator_display_name || chat.creator_username}</span>
              <span className="flex items-center gap-1">📥 {chat.import_count} imports</span>
              <span className="flex items-center gap-1">👁 {chat.view_count} views</span>
              <span className="flex items-center gap-1">📅 {new Date(chat.created_at).toLocaleDateString()}</span>
            </div>

            {chat.conversation_history && chat.conversation_history.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-[rgb(var(--color-text-primary))] mb-3">
                  {t.sharedChats?.conversationHistory || 'Conversation History'}
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {chat.conversation_history.slice(0, 10).map((msg, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded ${msg.role === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                          {msg.role === 'user' ? 'User' : 'AI'}
                        </span>
                        <span className="text-xs text-[rgb(var(--color-text-muted))]">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-[rgb(var(--color-text-primary))] whitespace-pre-wrap line-clamp-3">
                        {msg.content}
                      </p>
                    </div>
                  ))}
                  {chat.conversation_history.length > 10 && (
                    <p className="text-xs text-[rgb(var(--color-text-muted))] text-center">
                      {t.sharedChats?.andMore || '...and'} {chat.conversation_history.length - 10} {t.sharedChats?.moreMessages || 'more messages'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {chat.folder_snapshot?.files && chat.folder_snapshot.files.length > 0 && (
              <div>
                <h3 className="font-semibold text-[rgb(var(--color-text-primary))] mb-3">
                  {t.sharedChats?.filesPreview || 'Files Preview'} ({totalFiles})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {chat.folder_snapshot.files.slice(0, 20).map((file, idx) => (
                    <div key={file.id || idx} className="p-3 rounded-lg bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText size={18} className="text-[rgb(var(--color-text-muted))]" />
                          <span className="text-sm text-[rgb(var(--color-text-primary))] truncate max-w-[300px]">
                            {file.name}
                          </span>
                        </div>
                        {file.summary && (
                          <span className="text-xs text-[rgb(var(--color-text-muted))] px-2 py-0.5 bg-indigo-500/10 rounded">
                            {file.summary.slice(0, 50)}...
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {totalFiles > 20 && (
                    <p className="text-xs text-[rgb(var(--color-text-muted))] text-center">
                      {t.sharedChats?.andMore || '...and'} {totalFiles - 20} {t.sharedChats?.moreFiles || 'more files'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 shrink-0">
            <button
              onClick={() => copyShareUrl(chat.share_url)}
              className="p-2 hover:bg-[rgb(var(--color-surface-2))] rounded-lg text-[rgb(var(--color-text-secondary))] transition-colors"
              title={t.sharedChats?.copyLink || 'Copy link'}
            >
              <Copy size={18} />
            </button>
            <button
              onClick={() => {
                if (chat.import_count > 0) {
                  setShowImportDialog(true);
                } else {
                  handleImport();
                }
              }}
              disabled={importing}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : (t.sharedChats?.importBtn || 'Import')}
            </button>
          </div>
        </div>
      </div>

      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-[rgb(var(--color-surface-1))] rounded-xl border border-[rgb(var(--color-border))] p-6">
            <h3 className="font-semibold text-lg mb-2">{t.sharedChats?.importDialogTitle || 'Import Chat'}</h3>
            <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-4">
              {t.sharedChats?.importDialogDesc || 'Enter a new folder name (optional):'}
            </p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t.sharedChats?.folderNamePlaceholder || 'Leave empty to use original name'}
              className="w-full px-4 py-2.5 rounded-lg bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImportDialog(false)}
                className="px-4 py-2 rounded-lg border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-2))]"
              >
                {t.sharedChats?.cancel || 'Cancel'}
              </button>
              <button
                onClick={() => handleImport(newName || undefined)}
                disabled={importing}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : (t.sharedChats?.confirmImport || 'Import')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}