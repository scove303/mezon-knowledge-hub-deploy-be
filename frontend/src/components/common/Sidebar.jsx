import React, { useState, useEffect, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  File,
  Terminal,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Compass,
  FileCheck,
  Video,
  HardDrive,
  LogIn,
} from "lucide-react";
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

  const router = useRouter();
  const { isAuthenticated, clearAuth } = useAuthStore();

  const folders = store.getFilteredFolders();
  const selectedFolder = store.getSelectedFolder();
  const selectedFile = store.getSelectedFile();
  const searchQuery = store.searchQuery;
  const setSearchQuery = store.setSearch;

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);

  const selectFolder = (folderId) => {
    store.setSelectedFolder(folderId);
  };

  const selectFile = (folderId, fileId) => {
    store.setSelectedFolder(folderId);
    store.setSelectedFile(fileId);
    router.push(`/dashboard/folders/${folderId}`);
  };

  // 2. Sửa lại useCallback: Thay 'store' thành 'setFolders' ở mảng Dependency
  const refreshFolders = useCallback(async () => {
    setIsLoadingFolders(true);
    if (!isAuthenticated) {
      setFolders(MOCK_FOLDERS);
      setIsLoadingFolders(false);
      return;
    }

    try {
      const res = await folderService.getFolders();
      if (res.success) {
        setFolders(res.data);
      }
    } catch (err) {
      console.error(
        "Lỗi khi tải danh sách thư mục (sử dụng dữ liệu Mock thay thế):",
        err,
      );
      setFolders(MOCK_FOLDERS);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [isAuthenticated, setFolders]);

  useEffect(() => {
    Promise.resolve().then(() => {
      refreshFolders();
    });
  }, [refreshFolders]);

  useEffect(() => {
    const handler = (e) => {
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
    if (!isAuthenticated) {
      const newMockFolder = {
        id: `mock-folder-${Date.now()}`,
        name,
        type,
        files: [],
      };
      store.setFolders([...store.folders, newMockFolder]);
      return;
    }

    try {
      const res = await folderService.createFolder(name, type);
      if (res.success) {
        await refreshFolders();
      }
    } catch (err) {
      console.error("Lỗi khi tạo thư mục:", err);
    }
  };

  // Hàm xử lý kích hoạt xóa khi người dùng xác nhận ở Modal
  const confirmDelete = async () => {
    if (!itemToDelete) return;

    const { type, folderId, fileId } = itemToDelete;
    setDeleteConfirmOpen(false);

    if (type === "folder") {
      if (!isAuthenticated || folderId.startsWith("mock-")) {
        const updated = store.folders.filter((f) => f.id !== folderId);
        store.setFolders(updated);
        if (store.selectedFolderId === folderId) {
          store.setSelectedFolder(null);
          router.push("/dashboard");
        }
        return;
      }

      try {
        const res = await folderService.deleteFolder(folderId);
        if (res.success) {
          await refreshFolders();
          if (store.selectedFolderId === folderId) {
            store.setSelectedFolder(null);
            router.push("/dashboard");
          }
        }
      } catch (err) {
        console.error("Lỗi khi xóa thư mục:", err);
      }
    } else if (type === "file") {
      if (!isAuthenticated || fileId.startsWith("mock-")) {
        const updated = store.folders.map((f) => {
          if (f.id === folderId) {
            return {
              ...f,
              files: f.files.filter((file) => file.id !== fileId),
            };
          }
          return f;
        });
        store.setFolders(updated);
        if (store.selectedFileId === fileId) {
          store.setSelectedFile(null);
        }
        return;
      }

      try {
        const res = await fileService.deleteFile(fileId);
        if (res.success) {
          await refreshFolders();
          if (store.selectedFileId === fileId) {
            store.setSelectedFile(null);
          }
        }
      } catch (err) {
        console.error("Lỗi khi xóa file:", err);
      }
    }
  };

  const [expandedFolders, setExpandedFolders] = useState({});
  const [newFolderName, setNewFolderName] = useState("");
  const [showAddFolder, setShowAddFolder] = useState(false);

  const toggleExpand = (folderId, e) => {
    e.stopPropagation();
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

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
    <aside className="w-80 bg-[rgb(var(--color-surface-1))] border-r border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-[rgb(var(--color-border))] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <HardDrive className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[rgb(var(--color-text-primary))] tracking-wide">
              Mezon MindFolder
            </h1>
            <p className="text-xs text-indigo-400 font-medium">Knowledge Hub</p>
          </div>
        </div>

        {!isAuthenticated && (
          <button
            onClick={handleLoginRedirect}
            className="p-2 hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] hover:text-indigo-400 rounded-lg transition-colors"
            title="Đăng nhập"
          >
            <LogIn className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Search Bar */}
      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <input
            id="sidebar-search"
            type="text"
            placeholder="Tìm kiếm tài liệu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 rounded-lg pl-10 pr-4 py-2 text-sm text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] outline-none transition-all"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[rgb(var(--color-text-muted))]" />
        </div>
      </div>

      {/* Folder Navigation */}
      <div className="flex-1 overflow-y-auto px-3 space-y-4 pb-4 scrollbar-thin">
        {/* Header Section Label */}
        <div className="flex items-center justify-between px-2 text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wider">
          <span className={cn("truncate")}>
            Danh sách Thư Mục Của {`<USER>`} {!isAuthenticated && "(Bản thử)"}
          </span>
          <Button
            id="btn-add-folder"
            variant="ghost"
            size="icon"
            onClick={() => setShowAddFolder(!showAddFolder)}
            title="Tạo thư mục mới"
            className={cn("h-5 w-5 p-0 hover:bg-[rgb(var(--color-surface-2))]")}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Create Folder Form */}
        {showAddFolder && (
          <form
            onSubmit={handleCreateFolder}
            className="px-2 py-2 bg-[rgb(var(--color-bg))] rounded-lg border border-[rgb(var(--color-border))] space-y-2 animate-fade-in"
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
        {isLoadingFolders ? (
          <div className="px-4 py-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-4 h-4 rounded bg-[rgb(var(--color-surface-2))]" />
                <div className="h-3 rounded bg-[rgb(var(--color-surface-2))] w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {folders.length === 0 ? (
              <div className="text-center py-6 text-sm text-[rgb(var(--color-text-muted))]">
                Không tìm thấy tài liệu nào
              </div>
            ) : (
              folders.map((folder) => {
                const isExpanded = expandedFolders[folder.id] !== false;
                const isSelected =
                  selectedFolder?.id === folder.id && !selectedFile;

                return (
                  <li
                    key={folder.id}
                    className="group/folder rounded-lg overflow-hidden transition-all duration-150"
                  >
                    {/* Folder Header */}
                    <div
                      onClick={() => selectFolder(folder.id)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? "bg-indigo-600/10 text-indigo-300 border border-indigo-500/20 font-medium"
                          : "hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <button
                          onClick={(e) => toggleExpand(folder.id, e)}
                          className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] p-0.5 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {getFolderIcon(folder.type, isExpanded)}
                        <span className="text-sm truncate select-none">
                          {folder.name}
                        </span>
                      </div>

                      {/* Hover Actions */}
                      <div className="opacity-0 group-hover/folder:opacity-100 flex items-center space-x-1 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const addToast = useToastStore.getState().addToast;
                            addToast(
                              "Tài liệu mới chỉ có thể được tạo tự động bởi AI thông qua khung chat ở trang chính!",
                              "info",
                            );
                          }}
                          className="text-[rgb(var(--color-text-muted))] hover:text-indigo-400 p-0.5 rounded transition-colors"
                          title="Tạo file bằng AI"
                        >
                          <Plus className="w-3.5 h-3.5" />
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
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Children Files */}
                    {isExpanded && (
                      <ul className="pl-7 pr-1 mt-1 mb-2 space-y-1 border-l border-[rgb(var(--color-border))] ml-4 animate-fade-in">
                        {/* File Items */}
                        {folder.files &&
                          folder.files.map((file) => {
                            const isFileSelected = selectedFile?.id === file.id;
                            return (
                              <li
                                key={file.id}
                                onClick={() => selectFile(folder.id, file.id)}
                                className={`group/file flex items-center justify-between px-3 py-1.5 rounded cursor-pointer transition-colors ${
                                  isFileSelected
                                    ? "bg-indigo-600/15 text-indigo-400 font-semibold"
                                    : "hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]"
                                }`}
                              >
                                <div className="flex items-center space-x-2 min-w-0">
                                  {getFileIcon(file.name)}
                                  <span className="text-xs truncate select-none">
                                    {file.name}
                                  </span>
                                </div>
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
                                  className="opacity-0 group-hover/file:opacity-100 text-[rgb(var(--color-text-muted))] hover:text-rose-500 p-0.5 rounded transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </li>
                            );
                          })}

                        {(!folder.files || folder.files.length === 0) && (
                          <div className="text-[10px] text-[rgb(var(--color-text-disabled))] px-3 py-1 italic select-none">
                            Không có file nào
                          </div>
                        )}
                      </ul>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

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

      {/* Footer */}
      <div className="p-4 bg-[rgb(var(--color-bg))] border-t border-[rgb(var(--color-border))]">
        <UserProfileMenu />
      </div>
    </aside>
  );
}
