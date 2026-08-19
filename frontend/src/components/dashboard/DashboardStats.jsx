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
  Flame,
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

// Đọc danh sách ngày đã học (mf-study-days)
const readStudyDays = () => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("mf-study-days") || "[]");
  } catch {
    return [];
  }
};

// Streak: số ngày liên tiếp có học, kết thúc ở hôm nay (hoặc hôm qua)
const calcStreak = (days) => {
  const set = new Set(days);
  if (set.size === 0) return 0;
  let streak = 0;
  const d = new Date();
  if (!set.has(d.toISOString().slice(0, 10))) {
    d.setDate(d.getDate() - 1);
  }
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
};

export default function DashboardStats() {
  const router = useRouter();
  const { folders, setSelectedFile, isLoading } = useWorkspaceStore();

  const [doneCount, setDoneCount] = useState(0);

  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const loadDone = () => {
      try {
        const raw = localStorage.getItem("mf-lessons-done");
        setDoneCount(raw ? Object.keys(JSON.parse(raw)).length : 0);
      } catch {
        // ignore
      }
      setStreak(calcStreak(readStudyDays()));
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
    setSelectedFile(file.id);
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
      streak,
    },
  ];

  // Skeleton trong lúc tải lần đầu
  if (isLoading && !(folders?.length)) {
    return (
      <div className="w-full mt-3 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-4 rounded-xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] animate-pulse"
            >
              <div className="w-10 h-10 rounded-lg bg-[rgb(var(--color-surface-2))]" />
              <div className="space-y-2">
                <div className="h-5 w-12 rounded bg-[rgb(var(--color-surface-2))]" />
                <div className="h-2.5 w-20 rounded bg-[rgb(var(--color-surface-2))]" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] p-4 animate-pulse">
          <div className="h-4 w-32 rounded bg-[rgb(var(--color-surface-2))] mb-4" />
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`h-4 rounded bg-[rgb(var(--color-surface-2))] mb-3 ${
                i % 2 === 0 ? "w-full" : "w-3/4"
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mt-3 space-y-3">
      {(!folders || folders.length === 0) && (
        <div className="rounded-xl bg-[rgb(var(--color-surface-1))] border border-indigo-500/20 p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <FolderOpen size={22} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
              Bắt đầu hành trình học tập của bạn
            </div>
            <div className="text-xs text-[rgb(var(--color-text-muted))] mt-1 leading-relaxed">
              Nhập chủ đề bạn muốn học (ví dụ: &quot;Lộ trình Python cho người
              mới&quot;) vào khung chat bên dưới — AI sẽ tự động biên soạn lộ
              trình, chia bài học và lưu vào thư mục cho bạn.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-3 p-4 rounded-xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] hover:-translate-y-0.5 hover:shadow-md transition-all duration-[var(--transition-base)]"
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
              {card.streak > 1 && (
                <div className="text-[11px] font-medium text-orange-400 flex items-center gap-1 mt-0.5">
                  <Flame size={11} className="fill-orange-400" />
                  {card.streak} ngày liên tiếp
                </div>
              )}
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