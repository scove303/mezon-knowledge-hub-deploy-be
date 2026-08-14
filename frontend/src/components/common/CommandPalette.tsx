"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  Folder,
  Moon,
  Sun,
  Languages,
  Plus,
  LayoutDashboard,
  Network,
} from "lucide-react";
import { useWorkspaceStore } from "@/features/folders/store";
import { folderService } from "@/features/folders/services";
import { useToastStore } from "@/stores/toast";
import { useThemeStore } from "@/store/useThemeStore";
import { useLanguage } from "@/localization/LanguageContext";

type PaletteItem = {
  id: string;
  group: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  run: () => void;
};

export default function CommandPalette() {
  const router = useRouter();
  const store = useWorkspaceStore();
  const { theme, setTheme } = useThemeStore();
  const { currentLanguage, setCurrentLanguage } = useLanguage();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Ctrl+K để mở / đóng, Esc để đóng + reset
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // Không reset query/activeIndex → giữ nguyên trạng thái khi mở lại
        if (!open) {
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        } else {
          setOpen(false);
        }
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setActiveIndex(0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Tự cuộn item đang active vào trong tầm nhìn (không nhảy khỏi scroll view)
  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const openFile = useCallback(
    (folderId: string, fileId: string) => {
      store.setSelectedFolder(folderId);
      store.setSelectedFile(fileId);
      router.push(`/dashboard/folders/${folderId}`);
    },
    [router, store],
  );

  const openFolder = useCallback(
    (folderId: string) => {
      store.setSelectedFolder(folderId);
      router.push(`/dashboard/folders/${folderId}`);
    },
    [router, store],
  );

  const openMindmap = useCallback(
    (folderId: string, fileId?: string) => {
      store.setSelectedFolder(folderId);
      if (fileId) store.setSelectedFile(fileId);
      router.push(`/dashboard/folders/${folderId}?view=mindmap`);
    },
    [router, store],
  );

  const createFolderAction = useCallback(async () => {
    const name = query.trim();
    if (!name) return;
    try {
      const res = await folderService.createFolder(name, "general");
      if (res.success) {
        const foldersRes = await folderService.getFolders();
        if (foldersRes.success) store.setFolders(foldersRes.data);
        useToastStore
          .getState()
          .addToast(`Đã tạo thư mục "${name}"`, "success");
        setOpen(false);
      }
    } catch (err) {
      console.error("Lỗi khi tạo thư mục:", err);
      useToastStore.getState().addToast("Tạo thư mục thất bại", "error");
    }
  }, [query, store]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const list: PaletteItem[] = [];

    for (const folder of store.folders) {
      if (!q || folder.name.toLowerCase().includes(q)) {
        list.push({
          id: `folder-${folder.id}`,
          group: "Thư mục",
          label: folder.name,
          icon: <Folder className="w-4 h-4 text-amber-400 shrink-0" />,
          run: () => openFolder(folder.id),
        });
        list.push({
          id: `folder-mindmap-${folder.id}`,
          group: "Thư mục",
          label: folder.name,
          sublabel: "Sơ đồ tư duy",
          icon: <Network className="w-4 h-4 text-purple-400 shrink-0" />,
          run: () => openMindmap(folder.id),
        });
      }
      for (const file of folder.files || []) {
        if (!q || file.name.toLowerCase().includes(q)) {
          list.push({
            id: `file-${file.id}`,
            group: "Tài liệu",
            label: file.name,
            sublabel: folder.name,
            icon: <FileText className="w-4 h-4 text-blue-400 shrink-0" />,
            run: () => openFile(folder.id, file.id),
          });
          list.push({
            id: `file-mindmap-${file.id}`,
            group: "Tài liệu",
            label: file.name,
            sublabel: "Sơ đồ tư duy",
            icon: <Network className="w-4 h-4 text-purple-400 shrink-0" />,
            run: () => openMindmap(folder.id, file.id),
          });
        }
      }
    }

    list.push(
      {
        id: "action-create-folder",
        group: "Hành động",
        label: q ? `Tạo thư mục "${query.trim()}"` : "Tạo thư mục mới…",
        icon: <Plus className="w-4 h-4 text-emerald-400 shrink-0" />,
        run: createFolderAction,
      },
      {
        id: "action-theme",
        group: "Hành động",
        label:
          theme === "dark"
            ? "Chuyển sang giao diện sáng"
            : "Chuyển sang giao diện tối",
        icon:
          theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
          ),
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
      {
        id: "action-language",
        group: "Hành động",
        label:
          currentLanguage === "vn"
            ? "Đổi sang tiếng Anh (English)"
            : "Đổi sang tiếng Việt",
        icon: <Languages className="w-4 h-4 text-cyan-400 shrink-0" />,
        run: () =>
          setCurrentLanguage(currentLanguage === "vn" ? "en" : "vn"),
      },
      {
        id: "action-dashboard",
        group: "Hành động",
        label: "Về trang chủ",
        icon: (
          <LayoutDashboard className="w-4 h-4 text-[rgb(var(--color-text-muted))] shrink-0" />
        ),
        run: () => {
          setOpen(false);
          router.push("/dashboard");
        },
      },
    );

    return list.filter(
      (it) =>
        !q ||
        it.label.toLowerCase().includes(q) ||
        it.group.toLowerCase().includes(q),
    );
  }, [
    query,
    store,
    theme,
    currentLanguage,
    router,
    setTheme,
    setCurrentLanguage,
    openFile,
    openFolder,
    openMindmap,
    createFolderAction,
  ]);

  if (!open) return null;

  const groups: string[] = [];
  for (const it of items) {
    if (!groups.includes(it.group)) groups.push(it.group);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-lg bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-fade-in">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--color-text-muted))]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                items[activeIndex]?.run();
                // Đóng palette nhưng GIỮ query + activeIndex (Ctrl+K mở lại y chang)
                setOpen(false);
              }
            }}
            placeholder="Tìm tài liệu, thư mục hoặc gõ lệnh..."
            aria-label="Tìm tài liệu, thư mục hoặc gõ lệnh"
            className="w-full bg-transparent border-0 outline-none pl-11 pr-4 py-4 text-sm text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))]"
          />
        </div>

        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto scrollbar-thin border-t border-[rgb(var(--color-border))]"
        >
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[rgb(var(--color-text-muted))]">
              Không có kết quả cho &quot;{query}&quot;
            </div>
          ) : (
            items.map((it, idx) => {
              const showHeader = groups.includes(it.group) && items[idx - 1]?.group !== it.group;
              const isActive = idx === activeIndex;
              return (
                <div key={it.id}>
                  {showHeader && (
                    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-[rgb(var(--color-text-muted))]">
                      {it.group}
                    </p>
                  )}
                  <button
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      it.run();
                      // Đóng palette nhưng GIỮ query + activeIndex (Ctrl+K mở lại y chang)
                      setOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full text-left px-4 py-2.5 transition-colors ${
                      isActive
                        ? "bg-[rgb(var(--color-primary)/0.12)] text-[rgb(var(--color-primary))]"
                        : "text-[rgb(var(--color-text-secondary))]"
                    }`}
                  >
                    {it.icon}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">{it.label}</span>
                      {it.sublabel && (
                        <span className="block text-[11px] text-[rgb(var(--color-text-muted))] truncate">
                          {it.sublabel}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-[rgb(var(--color-border))] text-[10px] text-[rgb(var(--color-text-muted))]">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))]">↑↓</kbd>{" "}
            điều hướng
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))]">Enter</kbd>{" "}
            chọn
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))]">Esc</kbd>{" "}
            đóng
          </span>
        </div>
      </div>
    </div>
  );
}
