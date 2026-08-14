'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Folder,
  FileText,
  Video,
  CheckCircle2,
  Clock,
  FolderOpen,
} from 'lucide-react';
import { useWorkspaceStore } from '@/features/folders/store';

const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi)$/i;

const parseDate = (s) => {
  if (!s) return 0;
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  const t = Date.parse(String(s));
  return Number.isNaN(t) ? 0 : t;
};

const formatDate = (s) => {
  const t = parseDate(s);
  if (!t) return '';
  try {
    return new Date(t).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return String(s);
  }
};

export default function DashboardStats() {
  const router = useRouter();
  const { folders, setSelectedFile } = useWorkspaceStore();

  const [doneCount, setDoneCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      const raw = localStorage.getItem("mf-lessons-done");
      return raw ? Object.keys(JSON.parse(raw)).length : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const loadDone = () => {
      try {
        const raw = localStorage.getItem("mf-lessons-done");
        setDoneCount(raw ? Object.keys(JSON.parse(raw)).length : 0);
      } catch {
        // ignore
      }
    };
    window.addEventListener("mf-lessons-changed", loadDone);
    return () => window.removeEventListener("mf-lessons-changed", loadDone);
  }, []);

  const allFiles = [];
  for (const f of folders || []) {
    for (const file of f.files || []) {
      allFiles.push({ ...file, folderId: f.id, folderName: f.name });
    }
  }

  const videoCount = allFiles.filter((f) => VIDEO_EXT.test(f.name)).length;

  const recent = [...allFiles]
    .sort((a, b) => parseDate(b.created_at) - parseDate(a.created_at))
    .slice(0, 5);

  const openFile = (file) => {
    setSelectedFileId(file.id);
    router.push(`/dashboard/folders/${file.folderId}`);
  };

  const cards = [
    {
      label: 'Thư mục lộ trình',
      value: folders?.length || 0,
      icon: Folder,
      tint: 'bg-indigo-500/10 text-indigo-400',
    },
    {
      label: 'Tài liệu học tập',
      value: allFiles.length,
      icon: FileText,
      tint: 'bg-emerald-500/10 text-emerald-400',
    },
    {
      label: 'Video bài giảng',
      value: videoCount,
      icon: Video,
      tint: 'bg-purple-500/10 text-purple-400',
    },
    {
      label: 'Bài đã học',
      value: doneCount,
      icon: CheckCircle2,
      tint: 'bg-amber-500/10 text-amber-400',
    },
  ];

  return (
    <div className="w-full mt-3 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-3 p-4 rounded-xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))]"
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.tint}`}
            >
              <card.icon size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-bold text-[rgb(var(--color-text-primary))] leading-tight">
                {card.value}
              </div>
              <div className="text-[11px] text-[rgb(var(--color-text-muted))] truncate">
                {card.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-[rgb(var(--color-text-secondary))] mb-2">
          <Clock size={14} className="text-indigo-400" />
          Tài liệu gần đây
        </div>
        {recent.length === 0 ? (
          <p className="text-xs text-[rgb(var(--color-text-muted))] py-2">
            Chưa có tài liệu nào — hãy tạo lộ trình đầu tiên ở khung chat bên
            dưới!
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[rgb(var(--color-border))]">
            {recent.map((file) => (
              <button
                key={file.id}
                onClick={() => openFile(file)}
                className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-[rgb(var(--color-surface-2))] transition-colors text-left"
              >
                <FileText
                  size={15}
                  className="shrink-0 text-[rgb(var(--color-text-muted))]"
                />
                <span className="flex-1 min-w-0 text-sm text-[rgb(var(--color-text-primary))] truncate">
                  {file.name}
                </span>
                <span className="hidden sm:inline text-[11px] text-[rgb(var(--color-text-muted))] truncate max-w-[160px]">
                  {file.folderName}
                </span>
                <span className="text-[11px] text-[rgb(var(--color-text-muted))] shrink-0">
                  {formatDate(file.created_at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}