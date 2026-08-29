'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, Copy, ExternalLink, FolderOpen, Eye, Download, Plus, Share2, Check, AlertCircle } from 'lucide-react';
import { sharedChatService, type SharedChatDetail, type ImportChatResponse } from '@/features/shared-chats/services';
import { useAuthStore } from '@/features/auth/store';
import { useToastStore } from '@/stores/toast';
import { useLanguage } from '@/localization/LanguageContext';
import vn from "@/localization/languages/vn.json";
import en from "@/localization/languages/en.json";

const translation = { en, vn };

export default function ViewSharedChatPage() {
  const router = useRouter();
  const params = useParams();
  const shareCode = params.shareCode as string;
  const { isAuthenticated } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const { currentLanguage } = useLanguage();
  const t = translation[currentLanguage];

  const [chat, setChat] = useState<SharedChatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    loadChat();
  }, [shareCode]);

  const loadChat = async () => {
    setLoading(true);
    try {
      const res = await sharedChatService.getSharedChat(shareCode);
      if (res.success) {
        setChat(res.data);
      } else {
        router.push('/dashboard/shared-chats/public');
      }
    } catch (err) {
      console.error('Load shared chat error:', err);
      router.push('/dashboard/shared-chats/public');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setImporting(true);
    try {
      const res = await sharedChatService.importChat(shareCode, newFolderName || undefined);
      if (res.success) {
        addToast(t.sharedChats?.importSuccess || 'Chat imported successfully!', 'success');
        router.push(`/dashboard/folders/${res.data.folder_id}`);
      } else {
        addToast(res.message || t.sharedChats?.importError || 'Import failed', 'error');
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.response?.data?.detail?.message || t.sharedChats?.importError || 'Import failed';
      addToast(errorMsg, 'error');
    } finally {
      setImporting(false);
    }
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    addToast(t.sharedChats?.copied || 'Link copied!', 'success');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center text-red-400">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-semibold text-[rgb(var(--color-text-primary))] mb-2">
          {t.sharedChats?.notFound || 'Chat Not Found'}
        </h2>
        <p className="text-[rgb(var(--color-text-secondary))] mb-6">
          {t.sharedChats?.notFoundDesc || 'This shared chat does not exist or has expired.'}
        </p>
        <Link
          href="/dashboard/shared-chats/public"
          className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors inline-flex items-center gap-2 justify-center"
        >
          <Eye size={18} />
          {t.sharedChats?.browsePublic || 'Browse Public Chats'}
        </Link>
      </div>
    );
  }

  const files = chat.folder_snapshot?.files || [];
  const totalFiles = files.length;
  const totalChars = files.reduce((sum, f) => sum + (f.markdown_content?.length || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <h1 className="text-2xl md:text-3xl font-bold text-[rgb(var(--color-text-primary))]">
            {chat.title}
          </h1>
          {chat.is_public && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400">
              {t.sharedChats?.public || 'Public'}
            </span>
          )}
        </div>
        <p className="text-[rgb(var(--color-text-secondary))] mb-4">{chat.description || chat.topic}</p>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[rgb(var(--color-text-muted))]">
          <span className="flex items-center gap-1">👤 {chat.creator_display_name || chat.creator_username}</span>
          <span className="flex items-center gap-1">📁 {totalFiles} files</span>
          <span className="flex items-center gap-1">📝 {totalChars.toLocaleString()} chars</span>
          <span className="flex items-center gap-1">📥 {chat.import_count} imports</span>
          <span className="flex items-center gap-1">👁 {chat.view_count} views</span>
          <span className="flex items-center gap-1">📅 {new Date(chat.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-3 mb-8 p-4 rounded-xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))]">
        <button
          onClick={copyShareUrl}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-2))] transition-colors"
        >
          <Copy size={18} />
          {t.sharedChats?.copyLink || 'Copy Link'}
        </button>
        <Link
          href={chat?.share_url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-2))] transition-colors"
        >
          <ExternalLink size={18} />
          {t.sharedChats?.viewOriginal || 'View Original'}
        </Link>
        {isAuthenticated ? (
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen size={18} />}
            {importing ? (t.sharedChats?.importing || 'Importing...') : (t.sharedChats?.importToAccount || 'Import to My Account')}
          </button>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-500/30 text-indigo-400 font-medium hover:bg-indigo-500/10 transition-colors"
          >
            <FolderOpen size={18} />
            {t.sharedChats?.loginToImport || 'Login to Import'}
          </Link>
        )}
      </div>

      {/* Files Preview */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">
            {t.sharedChats?.filesPreview || 'Files Preview'} ({totalFiles})
          </h2>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {files.slice(0, 20).map((file, index) => (
            <div
              key={file.id}
              className="p-4 rounded-lg bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] hover:border-indigo-500/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[rgb(var(--color-text-primary))] truncate">
                      {file.name}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-500/20 text-indigo-400">
                      #{index + 1}
                    </span>
                  </div>
                  <p className="text-sm text-[rgb(var(--color-text-muted))] line-clamp-2">
                    {file.markdown_content?.slice(0, 200) || '(empty)'}
                    {file.markdown_content && file.markdown_content.length > 200 ? '...' : ''}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-[rgb(var(--color-text-muted))]">
                    <span>{(file.markdown_content?.length || 0).toLocaleString()} chars</span>
                    {file.video_url && <span>📹 Has video</span>}
                    {file.timestamps_json && <span>⏱ Has timestamps</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {totalFiles > 20 && (
            <div className="text-center py-4 text-[rgb(var(--color-text-muted))] border-t border-[rgb(var(--color-border))]">
              {t.sharedChats?.andMore || '...and'} {totalFiles - 20} {t.sharedChats?.moreFiles || 'more files'}
            </div>
          )}
        </div>

        {/* Conversation History */}
        {chat.conversation_history && chat.conversation_history.length > 0 && (
          <div className="mt-12 pt-8 border-t border-[rgb(var(--color-border))]">
            <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))] mb-4">
              {t.sharedChats?.conversationHistory || 'Conversation History'}
            </h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {chat.conversation_history.map((msg, idx) => (
                <div key={idx} className={`p-4 rounded-lg ${msg.role === 'user' ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-purple-500/10 border-purple-500/20'} border`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`font-medium text-sm ${msg.role === 'user' ? 'text-indigo-400' : 'text-purple-400'}`}>
                      {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                    </span>
                    {msg.timestamp && (
                      <span className="text-xs text-[rgb(var(--color-text-muted))]">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-[rgb(var(--color-text-primary))] whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}