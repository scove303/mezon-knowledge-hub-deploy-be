import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

// Timer hoãn xóa (module scope để React Compiler không chặn việc modify trong handler)
let deleteTimer = null;
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FileText,
  FileCode,
  FileJson,
  File,
  Terminal,
  Search,
  Plus,
  Trash2,
  Pencil,
  Star,
  Compass,
  FileCheck,
  Video,
  HardDrive,
  LogIn,
  Upload,
  SquareCheckBig,
  CheckCircle2,
} from "lucide-react";
import {
  Tree,
  File as TreeFile,
  Folder as TreeFolder,
  CollapseButton,
} from "@/components/ui/file-tree";
import { Button } from "@/components/base-ui/Button";
import { Modal } from "@/components/base-ui/Modal";
import { useAuthStore } from "@/features/auth/store";
import { useWorkspaceStore } from "@/features/folders/store";
import { folderService } from "@/features/folders/services";
import { fileService } from "@/features/files/services";
import { useToastStore } from "@/stores/toast";
import { useRouter } from "next/navigation";
import UserProfileMenu from "@/features/home/components/UserProfileMenu";
import { cn } from "@/utils/formatTailwind";

import { useLanguage } from '@/localization/LanguageContext';
import vn from "@/localization/languages/vn.json";
import en from "@/localization/languages/en.json";

const translation = {
  en: en,
  vn: vn
}

// Dữ liệu mock dùng làm dự phòng khi không đăng nhập hoặc backend offline
const MOCK_FOLDERS = [
  {
    id: "mock-folder-1",
    name: "🐍 Lộ trình Python cho người mới",
    type: "roadmap",
    files: [
      {
        id: "mock-file-1",
        name: "Tong_quan.md",
        createdAt: "23/07/2026",
        content:
          "# Lộ Trình Học Python\n\nChào mừng bạn đến với lộ trình học Python! Dưới đây là các chủ đề chính:\n\n- [x] Cú pháp cơ bản\n- [ ] Lập trình hướng đối tượng (OOP)\n- [ ] Xử lý file và ngoại lệ\n- [ ] Làm việc với cơ sở dữ liệu MySQL",
      },
    ],
  },
  {
    id: "mock-folder-2",
    name: "📄 Nghiên cứu AI Agents",
    type: "document",
    files: [
      {
        id: "mock-file-2",
        name: "Action_Items.md",
        createdAt: "23/07/2026",
        content:
          "# Kế hoạch hành động AI Agents\n\nTập trung nghiên cứu các framework chính:\n\n1. LangChain / LangGraph\n2. Autogen\n3. CrewAI\n\n*Mục tiêu: Đưa ra so sánh chi tiết giữa các framework trong tháng này.*",
      },
    ],
  },
  {
    id: "mock-folder-3",
    name: "🎥 Video System Design",
    type: "video",
    files: [
      {
        id: "mock-file-3",
        name: "Video_Summary.md",
        createdAt: "23/07/2026",
        content:
          "# Tóm tắt Video Kiến trúc Hệ thống\n\nCác nội dung chính kèm mốc thời gian:\n\n- [00:00](timestamp://0) : Giới thiệu tổng quan\n- [03:15](timestamp://195) : Phân biệt Monolith và Microservices\n- [08:45](timestamp://525) : Thiết kế cơ sở dữ liệu phân tán",
        videoUrl: "https://www.youtube.com/watch?v=xpDnVSmNFX0",
        timestamps: [
          { time: "00:00", seconds: 0, text: "Giới thiệu tổng quan" },
          { time: "03:15", seconds: 195, text: "Monolith vs Microservices" },
          {
            time: "08:45",
            seconds: 525,
            text: "Thiết kế cơ sở dữ liệu phân tán",
          },
        ],
      },
    ],
  },
];

// Hàm highlight phần khớp với từ khóa tìm kiếm trong tên file / thư mục
const highlightMatch = (text, query) => {
  if (!query || !query.trim()) return text;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-indigo-500/30 text-indigo-200 rounded px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
};

// Hàm trả về icon phù hợp theo tên / phần mở rộng file
const getFileIcon = (fileName) => {
  if (!fileName) return <File className="w-4 h-4 text-gray-400 shrink-0" />;

  const lowerName = fileName.toLowerCase();
  const ext =
    fileName.includes(".") && fileName.lastIndexOf(".") > 0
      ? fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase()
      : "";

  // Các file cấu hình đặc biệt hoặc tên cố định
  if (lowerName === "dockerfile" || lowerName.startsWith("dockerfile.")) {
    return <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />;
  }
  if (lowerName === ".gitignore" || lowerName === ".env") {
    return <FileCode className="w-4 h-4 text-gray-400 shrink-0" />;
  }

  // Nhận diện theo phần mở rộng
  switch (ext) {
    case "py":
      return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;
    case "md":
      return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
    case "json":
      return <FileJson className="w-4 h-4 text-yellow-300 shrink-0" />;
    case "yml":
    case "yaml":
    case "toml":
    case "ini":
      return <FileCode className="w-4 h-4 text-purple-400 shrink-0" />;
    case "sql":
      return <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />;
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return <FileCode className="w-4 h-4 text-yellow-400 shrink-0" />;
    case "sh":
    case "bash":
    case "file":
      return <Terminal className="w-4 h-4 text-green-400 shrink-0" />;
    default:
      return <File className="w-4 h-4 text-gray-400 shrink-0" />;
  }
};

export default function Sidebar() {
  const store = useWorkspaceStore();

  // 1. Tách riêng hàm setFolders từ store (hàm này sẽ ổn định tham chiếu, không bị đổi)
  const setFolders = useWorkspaceStore((state) => state.setFolders);
  const setStoreLoading = useWorkspaceStore((state) => state.setLoading);

  const router = useRouter();
  const { isAuthenticated, clearAuth } = useAuthStore();

  const folders = store.getFilteredFolders();
  const selectedFolder = store.getSelectedFolder();
  const selectedFile = store.getSelectedFile();
  const searchQuery = store.searchQuery;
  const setSearchQuery = store.setSearch;
  const selectedFileIds = store.selectedFileIds;
  const toggleFileSelection = store.toggleFileSelection;
  const clearFileSelection = store.clearFileSelection;
  // Chế độ chọn nhiều: bật bằng nút, bấm file = chọn/bỏ chọn
  const [selectionArmed, setSelectionArmed] = useState(false);
  const selMode = selectedFileIds.length > 0 || selectionArmed;
  const clearAllSelection = useCallback(() => {
    setSelectionArmed(false);
    clearFileSelection();
  }, [clearFileSelection]);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  // Upload file thủ công: folder đích + input ẩn dùng chung
  const [uploadFolderId, setUploadFolderId] = useState(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadInputRef = useRef(null);
  // Drag & drop: file đang kéo + folder đang được hover làm đích
  const [draggingFile, setDraggingFile] = useState(null);
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  // Context menu chuột phải
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, type, folderId, fileId, name }
  // Ghim thư mục (lưu localStorage)
  const [pinnedIds, setPinnedIds] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("mf-pinned-folders") || "[]");
    } catch {
      return [];
    }
  });

  // Trạng thái bài đã học (đồng bộ qua event khi FileViewer thay đổi)
  const [doneMap, setDoneMap] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("mf-lessons-done") || "{}");
    } catch {
      return {};
    }
  });

  const loadDoneMap = useCallback(() => {
    try {
      setDoneMap(JSON.parse(localStorage.getItem("mf-lessons-done") || "{}"));
    } catch {
      setDoneMap({});
    }
  }, []);

  useEffect(() => {
    window.addEventListener("mf-lessons-changed", loadDoneMap);
    return () => window.removeEventListener("mf-lessons-changed", loadDoneMap);
  }, [loadDoneMap]);

  const folderBadge = (folder) => {
    const total = folder.files?.length || 0;
    if (!total) return undefined;
    const done = folder.files.filter((f) => doneMap[f.id]).length;
    return done > 0 ? `${done}/${total}` : total;
  };

  const togglePin = (folderId) => {
    setPinnedIds((prev) => {
      const next = prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId];
      try {
        localStorage.setItem("mf-pinned-folders", JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  // Upload file .md/.txt vào folder (không cần AI)
  const handleUploadChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadFolderId) return;
    setIsUploadingFile(true);
    setUploadProgress(0);
    try {
      const res = await fileService.uploadFile(uploadFolderId, file, (pct) =>
        setUploadProgress(pct),
      );
      if (res.success) {
        useToastStore
          .getState()
          .addToast(`Đã tải lên "${res.data.name}"`, "success");
        refreshFolders();
      } else {
        useToastStore.getState().addToast("Tải lên thất bại", "error");
      }
    } catch (err) {
      console.error("Lỗi upload file:", err);
      useToastStore.getState().addToast("Tải lên thất bại", "error");
    } finally {
      setIsUploadingFile(false);
      setUploadProgress(0);
      setUploadFolderId(null);
    }
  };

  // Folder đã ghim hiển thị trước
  const sortedFolders = useMemo(
    () =>
      [...folders].sort((a, b) => {
        const pa = pinnedIds.includes(a.id) ? 0 : 1;
        const pb = pinnedIds.includes(b.id) ? 0 : 1;
        return pa - pb;
      }),
    [folders, pinnedIds],
  );
  const {currentLanguage, setCurrentLanguage} = useLanguage();
  const currentText = translation[currentLanguage];

  const selectFolder = (folderId) => {
    store.setSelectedFolder(folderId);
  };

  const selectFile = (folderId, fileId) => {
    // Chế độ chọn nhiều: bấm file = chọn/bỏ chọn, không mở tài liệu
    if (selectionArmed) {
      toggleFileSelection(fileId);
      return;
    }
    store.setSelectedFolder(folderId);
    store.setSelectedFile(fileId);
    router.push(`/dashboard/folders/${folderId}`);
  };

  // Thoát chế độ chọn nhiều bằng phím Esc
  useEffect(() => {
    if (!selectionArmed) return;
    const onKey = (e) => {
      if (e.key === "Escape") clearAllSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectionArmed, clearAllSelection]);

  // Xóa hàng loạt các file đã chọn
  const confirmBulkDelete = async () => {
    const ids = [...selectedFileIds];
    setBulkDeleteOpen(false);
    if (!ids.length) return;
    const results = await Promise.allSettled(
      ids.map((id) => fileService.deleteFile(id)),
    );
    const okCount = results.filter((r) => r.status === "fulfilled").length;
    useToastStore
      .getState()
      .addToast(
        okCount === ids.length
          ? `Đã xóa ${okCount} tài liệu`
          : `Đã xóa ${okCount}/${ids.length} tài liệu (một số thất bại)`,
        okCount === ids.length ? "success" : "error",
      );
    if (store.selectedFileId && ids.includes(store.selectedFileId)) {
      store.setSelectedFile(null);
    }
    clearAllSelection();
    await refreshFolders();
  };

  // Cấu trúc cây cho Tree / CollapseButton (expand tất cả / thu gọn tất cả)
  const treeElements = sortedFolders.map((folder) => ({
    id: folder.id,
    isSelectable: true,
    name: folder.name,
    children: (folder.files || []).map((file) => ({
      id: file.id,
      isSelectable: true,
      name: file.name,
    })),
  }));

  // 2. Sửa lại useCallback: Thay 'store' thành 'setFolders' ở mảng Dependency
  const refreshFolders = useCallback(async () => {
    setIsLoadingFolders(true);
    setStoreLoading(true);
    try {
      const res = await folderService.getFolders();
      if (res.success) {
        setFolders(res.data);
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách thư mục:", err);
      setFolders([]);
    } finally {
      setIsLoadingFolders(false);
      setStoreLoading(false);
    }
  }, [setFolders, setStoreLoading, setIsLoadingFolders]);

  useEffect(() => {
    Promise.resolve().then(() => {
      refreshFolders();
    });
  }, [refreshFolders]);

  // Refresh khi có sự kiện bên ngoài yêu cầu (vd: phục hồi dữ liệu backup)
  useEffect(() => {
    const onFoldersChanged = () => refreshFolders();
    window.addEventListener("mf-folders-changed", onFoldersChanged);
    return () =>
      window.removeEventListener("mf-folders-changed", onFoldersChanged);
  }, [refreshFolders]);

  // Xử lý phím tắt Xóa (Có kiểm tra tránh kích hoạt khi người dùng đang gõ văn bản)
  useEffect(() => {
    const handler = (e) => {
      const isInputting =
        ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) ||
        document.activeElement?.isContentEditable;

      if (isInputting) return;

      // Ctrl+Z = hoàn tác thao tác xóa (giống nút "Hoàn tác" trên toast)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (deleteTimer) {
          e.preventDefault();
          clearTimeout(deleteTimer);
          deleteTimer = null;
          useToastStore
            .getState()
            .addToast("Đã hoàn tác, mục được giữ lại!", "success");
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const selFile = selectedFile;
        const selFolder = selectedFolder;
        if (selFile) {
          setItemToDelete({
            type: "file",
            folderId: folders.find((f) =>
              f.files?.some((fl) => fl.id === selFile.id),
            )?.id,
            fileId: selFile.id,
            name: selFile.name,
          });
          setDeleteConfirmOpen(true);
        } else if (selFolder) {
          setItemToDelete({
            type: "folder",
            folderId: selFolder.id,
            name: selFolder.name,
          });
          setDeleteConfirmOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedFile, selectedFolder, folders]);

  const createFolder = async (name, type) => {
    try {
      const res = await folderService.createFolder(name, type);
      if (res.success) {
        await refreshFolders();
      }
    } catch (err) {
      console.error("Lỗi khi tạo thư mục:", err);
    }
  };

  // Hàm thực thi xóa thật (sau 5s nếu không hoàn tác)
  const doDelete = async () => {
    if (!itemToDelete) return;

    const { type, folderId, fileId } = itemToDelete;

    if (type === "folder") {
      try {
        const res = await folderService.deleteFolder(folderId);
        if (res.success) {
          await refreshFolders();
          useToastStore
            .getState()
            .addToast("Đã xóa thư mục!", "success");
          if (store.selectedFolderId === folderId) {
            store.setSelectedFolder(null);
            router.push("/dashboard");
          }
        }
      } catch (err) {
        console.error("Lỗi khi xóa thư mục:", err);
      }
    } else if (type === "file") {
      try {
        const res = await fileService.deleteFile(fileId);
        if (res.success) {
          await refreshFolders();
          useToastStore
            .getState()
            .addToast("Đã xóa tài liệu!", "success");
          if (store.selectedFileId === fileId) {
            store.setSelectedFile(null);
          }
        }
      } catch (err) {
        console.error("Lỗi khi xóa file:", err);
      }
    }
  };

  // Xác nhận xóa: hoãn 5s để người dùng có thể hoàn tác
  const confirmDelete = () => {
    if (!itemToDelete) return;

    const name = itemToDelete.name || "mục này";
    setDeleteConfirmOpen(false);
    clearTimeout(deleteTimer);

    useToastStore
      .getState()
      .addToast(
        `Đã xóa "${name}"`,
        "info",
        5000,
        {
          label: "Hoàn tác",
          onClick: () => {
            clearTimeout(deleteTimer);
            useToastStore
              .getState()
              .addToast("Đã hoàn tác, mục được giữ lại!", "success");
          },
        },
      );

    deleteTimer = setTimeout(() => {
      doDelete();
    }, 5000);
  };

  const openRename = (item) => {
    setItemToRename(item);
    setRenameValue(item.name);
    setRenameOpen(true);
  };

  // Bắt đầu kéo một file
  const handleFileDragStart = (e, folderId, fileId) => {
    setDraggingFile({ fileId, folderId });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", fileId);
  };

  // Thả file vào folder đích
  const handleFolderDrop = async (e, folderId) => {
    e.preventDefault();
    setDragOverFolderId(null);
    if (!draggingFile || draggingFile.folderId === folderId) {
      setDraggingFile(null);
      return;
    }
    try {
      const res = await fileService.moveFile(draggingFile.fileId, folderId);
      if (res.success) {
        await refreshFolders();
        useToastStore.getState().addToast("Đã di chuyển tài liệu", "success");
      }
    } catch (err) {
      console.error("Lỗi khi di chuyển file:", err);
      useToastStore.getState().addToast("Di chuyển tài liệu thất bại", "error");
    }
    setDraggingFile(null);
  };

  // Mở context menu chuột phải tại vị trí con trỏ
  const openContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      ...item,
    });
  };

  // Đóng context menu khi click nơi khác / Esc / cuộn
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const onKey = (e) => {
      if (e.key === "Escape") setCtxMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [ctxMenu]);

  // Xử lý đổi tên file / thư mục sau khi người dùng xác nhận ở Modal
  const confirmRename = async () => {
    if (!itemToRename) return;
    const newName = renameValue.trim();
    if (!newName) return;
    if (newName === itemToRename.name) {
      setRenameOpen(false);
      return;
    }

    const { type, folderId, fileId } = itemToRename;
    setRenameOpen(false);
    try {
      const res =
        type === "folder"
          ? await folderService.renameFolder(folderId, newName)
          : await fileService.renameFile(fileId, newName);
      if (res.success) {
        await refreshFolders();
        useToastStore
          .getState()
          .addToast(
            `Đã đổi tên ${type === "folder" ? "thư mục" : "tài liệu"} thành "${newName}"`,
            "success",
          );
      }
    } catch (err) {
      console.error("Lỗi khi đổi tên:", err);
      useToastStore.getState().addToast("Đổi tên thất bại", "error");
    }
  };

  const [newFolderName, setNewFolderName] = useState("");
  const [showAddFolder, setShowAddFolder] = useState(false);

  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const types = ["roadmap", "document", "video"];
    const randomType = types[folders.length % 3];
    const emoji =
      randomType === "roadmap"
        ? "🐍 "
        : randomType === "document"
          ? "📄 "
          : "🎥 ";

    createFolder(emoji + newFolderName.trim(), randomType);
    setNewFolderName("");
    setShowAddFolder(false);
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const handleLoginRedirect = () => {
    router.push("/login");
  };

  const getFolderIcon = (type, isExpanded) => {
    if (isExpanded) {
      return <FolderOpen className="w-4 h-4 text-amber-300/90 shrink-0" />;
    }

    switch (type) {
      case "roadmap":
        return <Compass className="w-4 h-4 text-emerald-400" />;
      case "document":
        return <FileCheck className="w-4 h-4 text-cyan-400" />;
      case "video":
        return <Video className="w-4 h-4 text-rose-400" />;
      default:
        return <Folder className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <aside className="w-full bg-[rgb(var(--color-surface-1))] border-r border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-[rgb(var(--color-border))] flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center space-x-3 group text-left cursor-pointer"
          title="Về trang chủ"
        >
          <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 transition-transform group-hover:scale-105">
            <HardDrive className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[rgb(var(--color-text-primary))] tracking-wide transition-colors group-hover:text-indigo-400">
              Mezon MindFolder
            </h1>
            <p className="text-xs text-indigo-400 font-medium">Knowledge Hub</p>
          </div>
        </button>

        {!isAuthenticated && (
          <button
            onClick={handleLoginRedirect}
            className="p-2 hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] hover:text-indigo-400 rounded-lg transition-colors"
            title="Đăng nhập"
            aria-label="Đăng nhập"
          >
            <LogIn className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Search Bar */}
      {/* Search */}
      <div className="px-6 py-3 border-b border-[rgb(var(--color-border))]/40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--color-text-muted))]" />
          <input
            id="sidebar-search"
            type="text"
            placeholder={currentText.searchBar.placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[rgb(var(--color-surface-2))/40] border border-[rgb(var(--color-border))] focus:border-[rgb(var(--color-primary))] focus:ring-1 focus:ring-[rgb(var(--color-primary)/0.4)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] outline-none transition-all"
          />
        </div>
      </div>

      {/* Folder Navigation */}
      <div className="flex-1 min-h-0 flex flex-col pb-4">
        {/* Input ẩn dùng cho upload file thủ công */}
        <input
          ref={uploadInputRef}
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          className="hidden"
          onChange={handleUploadChange}
        />
        {/* Header Section Label */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[rgb(var(--color-border))]/40 shrink-0">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[rgb(var(--color-text-muted))] truncate">
            {currentText.sidebar.file_list.header} {`<USER>`}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] opacity-60 text-[rgb(var(--color-text-muted))] mr-0.5">
              {folders.length}
            </span>
            <Button
              id="btn-add-folder"
              variant="ghost"
              size="icon"
              onClick={() => setShowAddFolder(!showAddFolder)}
              title="Tạo thư mục mới"
              aria-label="Tạo thư mục mới"
              className={cn("h-7 w-7 p-0 rounded-md hover:bg-[rgb(var(--color-surface-2))] hover:text-[rgb(var(--color-primary))]")}
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              id="btn-multiselect"
              variant={selMode ? "primary" : "ghost"}
              size="icon"
              onClick={() =>
                selectionArmed ? clearAllSelection() : setSelectionArmed(true)
              }
              title={selectionArmed ? "Hủy chọn nhiều" : "Chọn nhiều tài liệu"}
              aria-label={selectionArmed ? "Hủy chọn nhiều" : "Chọn nhiều tài liệu"}
              className={cn("h-7 w-7 p-0 rounded-md hover:bg-[rgb(var(--color-surface-2))] hover:text-[rgb(var(--color-primary))]")}
            >
              <SquareCheckBig className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Create Folder Form */}
        {showAddFolder && (
          <form
            onSubmit={handleCreateFolder}
            className="mx-6 my-3 px-4 py-3 bg-[rgb(var(--color-bg))] rounded-lg border border-[rgb(var(--color-border))] space-y-2 animate-fade-in shrink-0"
          >
            <input
              type="text"
              placeholder="Tên thư mục mới..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] rounded px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 text-[rgb(var(--color-text-primary))]"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowAddFolder(false)}
              >
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="xs">
                Tạo
              </Button>
            </div>
          </form>
        )}

        {/* Folders List */}
        <div className="flex-1 min-h-0">
          {isLoadingFolders ? (
            <div className="px-4 py-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-4 h-4 rounded bg-[rgb(var(--color-surface-2))]" />
                  <div className="h-3 rounded bg-[rgb(var(--color-surface-2))] w-3/4" />
                </div>
              ))}
            </div>
          ) : folders.length === 0 ? (
            searchQuery ? (
              <div className="text-center py-6 px-4">
                <div className="text-sm font-medium text-[rgb(var(--color-text-secondary))]">
                  {currentText.searchBar.no_documents_found.header}
                </div>
                <div className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
                  {currentText.searchBar.no_documents_found.body} &quot;{searchQuery}&quot;
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center px-6 py-10">
                <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                  <FolderPlus className="w-6 h-6 text-indigo-400" />
                </div>
                <p className="text-sm font-semibold text-[rgb(var(--color-text-secondary))]">
                  {currentText.sidebar.empty_file_list.header}
                </p>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 max-w-[220px] leading-relaxed">
                  {currentText.sidebar.empty_file_list.body}
                </p>
                <button
                  onClick={() => setShowAddFolder(true)}
                  className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {currentText.sidebar.empty_file_list.button}
                </button>
              </div>
            )
          ) : (
            <Tree
              className="p-0"
              initialExpandedItems={sortedFolders.map((folder) => folder.id)}
              elements={treeElements}
            >
              <CollapseButton
                elements={treeElements}
                className="flex items-center justify-between w-full px-4 py-2.5 h-auto rounded-lg text-sm font-semibold text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface-2))]"
                title="Mở rộng / Thu gọn tất cả"
                aria-label="Mở rộng / Thu gọn tất cả thư mục"
              >
                <span className="text-[13px] font-semibold text-[rgb(var(--color-text-primary))]">
                  Tất cả thư mục
                </span>
                <span className="text-[11px] opacity-60">
                  {sortedFolders.length}
                </span>
              </CollapseButton>
              {sortedFolders.map((folder) => {
                const isSelected =
                  selectedFolder?.id === folder.id && !selectedFile;

                return (
                  <TreeFolder
                    key={folder.id}
                    value={folder.id}
                    element={
                      <>
                        {pinnedIds.includes(folder.id) && (
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400 inline-block shrink-0 mr-1 -mt-px" />
                        )}
                        {highlightMatch(folder.name, searchQuery)}
                      </>
                    }
                    isSelect={isSelected}
                    onSelect={(id) => selectFolder(id)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-2))] ${
                      dragOverFolderId === folder.id &&
                      draggingFile &&
                      draggingFile.folderId !== folder.id
                        ? "ring-2 ring-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary)/0.08)]"
                        : ""
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverFolderId(folder.id);
                    }}
                    onDragLeave={() =>
                      setDragOverFolderId((id) =>
                        id === folder.id ? null : id,
                      )
                    }
                    onDrop={(e) => handleFolderDrop(e, folder.id)}
                    onContextMenu={(e) =>
                      openContextMenu(e, {
                        type: "folder",
                        folderId: folder.id,
                        name: folder.name,
                      })
                    }
                    badge={folderBadge(folder)}
                    openIcon={
                      <FolderOpen className="w-4 h-4 text-amber-300/90 shrink-0" />
                    }
                    closeIcon={getFolderIcon(folder.type, false)}
                    actions={
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openRename({
                              type: "folder",
                              folderId: folder.id,
                              name: folder.name,
                            });
                          }}
                          className="text-[rgb(var(--color-text-muted))] hover:text-amber-400 p-0.5 rounded transition-colors"
                          title="Đổi tên thư mục"
                          aria-label="Đổi tên thư mục"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(folder.id);
                          }}
                          className={`p-0.5 rounded transition-colors ${
                            pinnedIds.includes(folder.id)
                              ? "text-amber-400"
                              : "text-[rgb(var(--color-text-muted))] hover:text-amber-400"
                          }`}
                          title={
                            pinnedIds.includes(folder.id)
                              ? "Bỏ ghim thư mục"
                              : "Ghim thư mục"
                          }
                          aria-label={
                            pinnedIds.includes(folder.id)
                              ? "Bỏ ghim thư mục"
                              : "Ghim thư mục"
                          }
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              pinnedIds.includes(folder.id)
                                ? "fill-amber-400"
                                : ""
                            }`}
                          />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadFolderId(folder.id);
                            uploadInputRef.current?.click();
                          }}
                          disabled={isUploadingFile}
                          className="text-[rgb(var(--color-text-muted))] hover:text-indigo-400 p-0.5 rounded transition-colors disabled:opacity-40"
                          title="Tải lên file (md/txt)"
                          aria-label="Tải lên file (md/txt)"
                        >
                          {isUploadingFile && uploadFolderId === folder.id && uploadProgress > 0 ? (
                            <span className="text-[10px] font-bold text-indigo-400 leading-none">
                              {uploadProgress}%
                            </span>
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete({
                              type: "folder",
                              folderId: folder.id,
                              name: folder.name,
                            });
                            setDeleteConfirmOpen(true);
                          }}
                          className="text-[rgb(var(--color-text-muted))] hover:text-rose-500 p-0.5 rounded transition-colors"
                          title="Xóa thư mục"
                          aria-label="Xóa thư mục"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    }
                  >
                    {folder.files &&
                      folder.files.map((file) => (
                        <TreeFile
                          key={file.id}
                          value={file.id}
                          isSelect={selectedFile?.id === file.id}
                          handleSelect={() =>
                            selectFile(folder.id, file.id)
                          }
                          className={`px-4 py-1.5 rounded-md text-[13px] ${
                            draggingFile?.fileId === file.id
                              ? "opacity-40"
                              : ""
                          }`}
                          draggable
                          onDragStart={(e) =>
                            handleFileDragStart(e, folder.id, file.id)
                          }
                          onDragEnd={() => {
                            setDraggingFile(null);
                            setDragOverFolderId(null);
                          }}
                          onContextMenu={(e) =>
                            openContextMenu(e, {
                              type: "file",
                              folderId: folder.id,
                              fileId: file.id,
                              name: file.name,
                            })
                          }
                          fileIcon={
                            selectionArmed &&
                            selectedFileIds.includes(file.id) ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              getFileIcon(file.name)
                            )
                          }
                          preview={
                            !selectionArmed && (
                              <div className="mx-2 p-3 rounded-lg bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] shadow-xl shadow-black/30 animate-fade-in">
                                <div className="text-xs font-semibold text-[rgb(var(--color-text-primary))] truncate">
                                  {file.name}
                                </div>
                                <div className="text-[11px] text-[rgb(var(--color-text-muted))] mt-1 line-clamp-3 whitespace-pre-line leading-relaxed">
                                  {(file.content || "Chưa có nội dung").slice(0, 200)}
                                </div>
                                <div className="text-[10px] text-[rgb(var(--color-text-disabled))] mt-1.5">
                                  Cập nhật {file.createdAt || file.created_at || "—"}
                                </div>
                              </div>
                            )
                          }
                          actions={
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRename({
                                    type: "file",
                                    folderId: folder.id,
                                    fileId: file.id,
                                    name: file.name,
                                  });
                                }}
                                className="text-[rgb(var(--color-text-muted))] hover:text-amber-400 p-0.5 rounded transition-colors"
                                title="Đổi tên tài liệu"
                                aria-label="Đổi tên tài liệu"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemToDelete({
                                    type: "file",
                                    folderId: folder.id,
                                    fileId: file.id,
                                    name: file.name,
                                  });
                                  setDeleteConfirmOpen(true);
                                }}
                                className="text-[rgb(var(--color-text-muted))] hover:text-rose-500 p-0.5 rounded transition-all"
                                title="Xóa tài liệu"
                                aria-label="Xóa tài liệu"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          }
                        >
                          <span className="min-w-0 truncate text-xs">
                            {highlightMatch(file.name, searchQuery)}
                          </span>
                        </TreeFile>
                      ))}

                    {(!folder.files || folder.files.length === 0) && (
                      <div className="text-[10px] text-[rgb(var(--color-text-disabled))] px-4 py-1 italic select-none">
                        Không có file nào
                      </div>
                    )}
                  </TreeFolder>
                );
              })}
            </Tree>
          )}
        </div>
      </div>

      {/* Context Menu (chuột phải) */}
      {ctxMenu && (
        <div
          className="fixed z-50 w-48 py-1 bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] rounded-lg shadow-xl shadow-black/40 animate-fade-in"
          style={{
            left: Math.min(
              ctxMenu.x,
              (typeof window !== "undefined" ? window.innerWidth : 800) - 200,
            ),
            top: Math.min(
              ctxMenu.y,
              (typeof window !== "undefined" ? window.innerHeight : 600) - 140,
            ),
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            onClick={() => {
              openRename(ctxMenu);
              setCtxMenu(null);
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-2))] hover:text-amber-400 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Đổi tên
          </button>
          {ctxMenu.type === "folder" && (
            <button
              onClick={() => {
                togglePin(ctxMenu.folderId);
                setCtxMenu(null);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-2))] hover:text-amber-400 transition-colors"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  pinnedIds.includes(ctxMenu.folderId)
                    ? "text-amber-400 fill-amber-400"
                    : ""
                }`}
              />
              {pinnedIds.includes(ctxMenu.folderId) ? "Bỏ ghim" : "Ghim thư mục"}
            </button>
          )}
          <button
            onClick={() => {
              setItemToDelete({
                type: ctxMenu.type,
                folderId: ctxMenu.folderId,
                fileId: ctxMenu.fileId,
                name: ctxMenu.name,
              });
              setDeleteConfirmOpen(true);
              setCtxMenu(null);
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-rose-400 hover:bg-[rgb(var(--color-surface-2))] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Xóa
          </button>
        </div>
      )}

      {/* Modal Đổi Tên */}
      <Modal
        isOpen={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={itemToRename?.type === "folder" ? "Đổi Tên Thư Mục" : "Đổi Tên Tài Liệu"}
        size="sm"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={confirmRename}
              disabled={!renameValue.trim()}
            >
              Đổi tên
            </Button>
          </div>
        }
      >
        <label className="block text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1.5">
          Tên mới
        </label>
        <input
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmRename();
          }}
          autoFocus
          className="w-full bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] rounded px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 text-[rgb(var(--color-text-primary))]"
        />
      </Modal>

      {/* Modal Xác Nhận Xóa */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title={itemToDelete?.type === "folder" ? "Xóa Thư Mục" : "Xóa Tài Liệu"}
        size="sm"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Đồng ý xóa
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[rgb(var(--color-text-secondary))] leading-relaxed">
          Bạn có chắc chắn muốn xóa{" "}
          {itemToDelete?.type === "folder"
            ? `thư mục "${itemToDelete?.name}" và toàn bộ tài liệu bên trong? Hành động này không thể hoàn tác.`
            : `tài liệu "${itemToDelete?.name}" khỏi thư mục?`}
        </p>
      </Modal>

      {/* Modal Xác Nhận Xóa Hàng Loạt */}
      <Modal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title="Xóa Nhiều Tài Liệu"
        size="sm"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setBulkDeleteOpen(false)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={confirmBulkDelete}>
              Xóa {selectedFileIds.length} tài liệu
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[rgb(var(--color-text-secondary))] leading-relaxed">
          Bạn có chắc chắn muốn xóa{" "}
          <span className="font-semibold">{selectedFileIds.length} tài liệu</span>{" "}
          đã chọn? Hành động này không thể hoàn tác.
        </p>
      </Modal>

      {/* Thanh hành động chế độ chọn nhiều */}
      {selMode && (
        <div className="px-3 py-2.5 border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-1))] shrink-0 animate-fade-in">
          <div className="text-[11px] font-medium text-[rgb(var(--color-text-muted))] mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Đã chọn {selectedFileIds.length} tài liệu
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={selectedFileIds.length === 0}
              className="flex-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa đã chọn
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAllSelection}>
              Hủy
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 bg-[rgb(var(--color-bg))] border-t border-[rgb(var(--color-border))]">
        <UserProfileMenu />
      </div>
    </aside>
  );
}
