'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Copy, Trash2, ExternalLink, Plus } from 'lucide-react';
import { sharedChatService, type SharedChat } from '@/features/shared-chats/services';
import { useAuthStore } from '@/features/auth/store';
import { useToastStore } from '@/stores/toast';
import { useLanguage } from '@/localization/LanguageContext';
import vn from "@/localization/languages/vn.json";
import en from "@/localization/languages/en.json";

const translation = { en, vn };

export default function MySharedChatsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const { currentLanguage } = useLanguage();
  const t = translation[currentLanguage];

  const [chats, setChats] = useState<SharedChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadChats();
  }, [isAuthenticated, router]);

  const loadChats = async () => {
    setLoading(true);
    try {
      const res = await sharedChatService.getMySharedChats();
      if (res.success) {
        setChats(res.data || []);
      }
    } catch (err) {
      console.error('Load my shared chats error:', err);
      addToast(t.sharedChats?.loadError || 'Failed to load chats', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    addToast(t.sharedChats?.copied || 'Link copied!', 'success');
  };

  const handleDelete = async (chatId: string) => {
    if (!confirm(t.sharedChats?.deleteConfirm || 'Delete this shared chat?')) return;
    try {
      const res = await sharedChatService.deleteSharedChat(chatId);
      if (res.success) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        addToast(t.sharedChats?.deleted || 'Deleted', 'success');
      }
    } catch (err) {
      addToast(t.sharedChats?.deleteError || 'Delete failed', 'error');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[rgb(var(--color-text-primary))] mb-2">
          {t.sharedChats?.myTitle || '📤 My Shared Chats'}
        </h1>
        <p className="text-[rgb(var(--color-text-secondary))]">
          {t.sharedChats?.myDesc || 'Manage your shared learning chats.'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      ) : chats.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
            <Plus size={32} />
          </div>
          <h3 className="text-lg font-medium text-[rgb(var(--color-text-primary))] mb-2">
            {t.sharedChats?.noSharedChats || 'No shared chats yet'}
          </h3>
          <p className="text-[rgb(var(--color-text-secondary))] mb-6 max-w-md mx-auto">
            {t.sharedChats?.noSharedChatsDesc || 'Share your learning folders with the community or keep them private for yourself.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {chats.map((chat) => (
            <MySharedChatCard key={chat.id} chat={chat} onCopyUrl={handleCopyUrl} onDelete={handleDelete} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function MySharedChatCard({ chat, onCopyUrl, onDelete, t }: { chat: SharedChat; onCopyUrl: (url: string) => void; onDelete: (chatId: string) => void; t: any }) {
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="p-5 rounded-xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-semibold text-[rgb(var(--color-text-primary))] truncate">{chat.title}</h3>
            <span className={`px-2 py-0.5 text-xs rounded-full ${chat.is_public ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
              {chat.is_public ? (t.sharedChats?.public || 'Public') : (t.sharedChats?.private || 'Private')}
            </span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-500/20 text-indigo-400">
              {chat.share_code}
            </span>
          </div>
          <p className="text-sm text-[rgb(var(--color-text-secondary))] line-clamp-2 mb-3">{chat.description || chat.topic}</p>
          <div className="flex items-center gap-4 text-xs text-[rgb(var(--color-text-muted))] mb-3">
            <span className="flex items-center gap-1">📥 {chat.import_count} imports</span>
            <span className="flex items-center gap-1">👁 {chat.view_count} views</span>
            <span className="flex items-center gap-1">📅 {new Date(chat.created_at).toLocaleDateString()}</span>
            {chat.expires_at && (
              <span className="flex items-center gap-1 text-orange-400">⏰ Expires: {new Date(chat.expires_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onCopyUrl(chat.share_url)}
            className="p-2 hover:bg-[rgb(var(--color-surface-2))] rounded-lg text-[rgb(var(--color-text-secondary))] transition-colors"
            title={t.sharedChats?.copyLink || 'Copy link'}
          >
            <Copy size={18} />
          </button>
          <Link
            href={chat.share_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-[rgb(var(--color-surface-2))] rounded-lg text-[rgb(var(--color-text-secondary))] transition-colors"
            title={t.sharedChats?.view || 'View'}
          >
            <ExternalLink size={18} />
          </Link>
          <button
            onClick={() => onDelete(chat.id)}
            disabled={deleting}
            className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors disabled:opacity-50"
            title={t.sharedChats?.delete || 'Delete'}
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}