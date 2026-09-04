"use client"; // Bắt buộc khi sử dụng React hooks

import {
  useWorkspaceStore,
  CHAT_PANE_WIDTH_DEFAULT,
} from "@/features/folders/store";
import { fileService } from "@/features/files/services";
import { folderService } from "@/features/folders/services";
import { aiService } from "@/features/ai/services";
import FileViewer from "@/features/files/components/FileViewer";
import ResizeHandle from "@/components/common/ResizeHandle";
import dynamic from "next/dynamic";
import { useEffect, useState, use, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageProps } from "@/components/chat/ChatMessage";
import {
  PanelRightClose,
  PanelRight,
  Network,
  FileText,
  Upload,
  Loader2,
  Download,
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { useLanguage } from "@/localization/LanguageContext";
import vn from "@/localization/languages/vn.json";
import en from "@/localization/languages/en.json";
import { sharedChatService } from "@/features/shared-chats/services";
import { useToastStore } from "@/stores/toast";
import { useMediaQuery } from "@/hooks/useMediaQuery";

// Tách bundle: Mindmap (@xyflow/react) và Chat chỉ tải khi cần
const MindmapViewer = dynamic(
  () => import("@/features/mindmap/components/MindmapViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center text-[rgb(var(--color-text-muted))]">
        Đang tải sơ đồ tư duy...
      </div>
    ),
  },
);
const ChatHistory = dynamic(() => import("@/components/chat/ChatHistory"), {
  ssr: false,
});
const ChatInput = dynamic(() => import("@/components/chat/ChatInput"), {
  ssr: false,
  loading: () => (
    <div className="p-4 animate-pulse">
      <div className="h-11 rounded-lg bg-[rgb(var(--color-surface-2))]" />
    </div>
  ),
});

export default function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }> | { folderId: string };
}) {
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const folderId = resolvedParams.folderId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");

  const {
    folders,
    selectedFileId,
    selectedFolderId,
    setSelectedFile,
    setSelectedFolder,
    setSidebarOpen,
    isDocumentSideOpen,
    setDocumentSideOpen,
    toggleDocumentSide,
    setFolders,
    chatPaneWidth,
    setChatPaneWidth,
    getChatHistory,
    setChatHistory,
  } = useWorkspaceStore() as any;

  const [fileDetails, setFileDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const statusMsgId = useRef<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { currentLanguage } = useLanguage();
  const translation = { en, vn };
  const t = translation[currentLanguage];
  const addToast = useToastStore((s) => s.addToast);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [showMindmap, setShowMindmap] = useState(() => viewParam === "mindmap");
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{ share_url: string; share_code: string } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [includeChatHistory, setIncludeChatHistory] = useState(true);
  const [chatHistoryLoading, setChatHistoryLoading] = useState(true);
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Thêm State lưu trữ mốc thời gian cần nhảy tới khi mở file từ Mindmap
  const [initialSeekSeconds, setInitialSeekSeconds] = useState<number | null>(
    null,
  );
  const [messages, setMessages] = useState<MessageProps[]>([]);

  const folder = folders.find((f: any) => String(f.id) === String(folderId));

  // Load chat history on mount
  useEffect(() => {
    if (!folderId || folderId === "default") {
      setChatHistoryLoading(false);
      return;
    }
    const loadHistory = async () => {
      try {
        console.log('[FolderPage] Loading chat history for:', folderId);
        const res = await folderService.getChatHistory(folderId);
        console.log('[FolderPage] Load history response:', res);
        if (res.success && res.data && res.data.length > 0) {
          // Convert backend format to MessageProps format
          const history = res.data.map((m: any) => ({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          }));
          setMessages(history);
          setChatHistory(folderId, history);
        } else {
          // No history - show welcome message (marked as status so it won't be saved)
          const welcomeMsg: MessageProps = {
            id: "msg-1",
            role: "bot",
            content: "Thư mục tri thức đã được khởi tạo thành công. Bạn có thể xem tài liệu ở khung bên phải, hoặc tải thêm tài liệu/dán link YouTube vào đây để AI tóm tắt thêm vào thư mục này.",
            isStatus: true,
          };
          setMessages([welcomeMsg]);
        }
      } catch (err) {
        console.error("[FolderPage] Failed to load chat history:", err);
        // On error, show welcome message (marked as status so it won't be saved)
        const welcomeMsg: MessageProps = {
          id: "msg-1",
          role: "bot",
          content: "Thư mục tri thức đã được khởi tạo thành công. Bạn có thể xem tài liệu ở khung bên phải, hoặc tải thêm tài liệu/dán link YouTube vào đây để AI tóm tắt thêm vào thư mục này.",
          isStatus: true,
        };
        setMessages([welcomeMsg]);
      } finally {
        setChatHistoryLoading(false);
      }
    };
    loadHistory();
  }, [folderId, setChatHistory]);

  // Auto-save chat history with debounce (2 seconds)
  useEffect(() => {
    if (!folderId || folderId === "default") return;
    // Don't save if there are no real messages (only status/welcome messages)
    const hasRealMessages = messages.some(m => m.role === "user" || (m.role === "bot" && !m.isStatus));
    if (!hasRealMessages) return;
    
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }
    saveDebounceRef.current = setTimeout(async () => {
      try {
        console.log('[FolderPage] Auto-saving chat history for:', folderId, 'messages:', messages.length);
        await folderService.saveChatHistory(folderId, messages);
      } catch (err) {
        console.error("[FolderPage] Failed to save chat history:", err);
      }
    }, 2000);
    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, [messages, folderId]);

  // useEffect (1): Tự động mở Sidebar khi vào phòng chat
  useEffect(() => {
    if (folderId === "default") {
      router.replace("/dashboard");
    } else {
      setSidebarOpen(true);
    }
  }, [folderId, router, setSidebarOpen]);

  // Deep-link: /dashboard/folders/:id?view=mindmap → mở sẵn khung tài liệu và sơ đồ tư duy
  useEffect(() => {
    if (viewParam === "mindmap") {
      setShowMindmap(true);
      setDocumentSideOpen(true);
    }
  }, [viewParam, setDocumentSideOpen]);

  useEffect(() => {
    if (!showMindmap) return;
    const t = setTimeout(() => setDocumentSideOpen(true), 0);
    return () => clearTimeout(t);
  }, [showMindmap, setDocumentSideOpen]);

  // useEffect (2): Tải chi tiết file khi người dùng bấm chọn ở Sidebar
  useEffect(() => {
    async function loadFile() {
      if (!selectedFileId) {
        setFileDetails(null);
        setLoadError(false);
        return;
      }

      try {
        setFileLoading(true);
        setLoadError(false);
        const res = await fileService.getFile(selectedFileId);
        if (res.success) {
          setFileDetails(res.data);
          setDocumentSideOpen(true);
          setShowMindmap(false);
        } else {
          setLoadError(true);
        }
      } catch (err) {
        console.error("Lỗi khi tải chi tiết tài liệu:", err);
        setLoadError(true);
      } finally {
        setFileLoading(false);
      }
    }
    loadFile();
  }, [selectedFileId, setDocumentSideOpen]);

  // Refetch danh sách thư mục khi quay lại tab (dữ liệu có thể đổi ở tab khác)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        folderService.getFolders().then((res) => {
          if (res.success) setFolders(res.data);
        });
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [setFolders]);

  // Xuất toàn bộ thư mục thành 1 file Markdown
  const handleExportFolder = async () => {
    const files = folder?.files || [];
    if (files.length === 0) {
      useToastStore.getState().addToast("Thư mục chưa có tài liệu", "info");
      return;
    }
    setIsExporting(true);
    try {
      const parts: string[] = [`# ${folder?.name || "Thư mục"}\n`];
      for (const f of files) {
        const res = await fileService.getFile(f.id);
        if (res.success && res.data?.content) {
          parts.push(`\n---\n\n## ${f.name}\n\n${res.data.content}`);
        }
      }
      const md = parts.join("\n");
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${folder?.name || "thu-muc"}.md`;
      a.click();
      URL.revokeObjectURL(url);
      useToastStore
        .getState()
        .addToast("Đã xuất thư mục ra file .md", "success");
    } catch (err) {
      console.error("Lỗi export folder:", err);
      useToastStore.getState().addToast("Xuất thư mục thất bại", "error");
    } finally {
      setIsExporting(false);
    }
  };

  // Chia sẻ thư mục thành chat
  const handleShareFolder = async () => {
    if (!folder) return;
    setSharing(true);
    try {
      const conversationHistory = includeChatHistory
        ? messages
            .filter((m) => m.role === "user" || m.role === "bot")
            .map((m) => ({ role: m.role, content: m.content, timestamp: new Date().toISOString() }))
        : [];
      const res = await sharedChatService.shareChat({
        folder_id: folderId,
        title: "Chat: " + folder.name,
        description: "Shared from " + folder.name,
        topic: folder.name,
        conversation_history: conversationHistory,
        is_public: false,
      });
      if (res.success && res.data?.share_url) {
        setShareResult({ share_url: res.data.share_url, share_code: res.data.share_code });
        setShowShareModal(true);
        setCopied(false);
        addToast(t.sharedChats?.shared || "Folder shared successfully!", "success");
      } else {
        addToast(res.message || "Share failed", "error");
      }
    } catch (err) {
      console.error("Share folder error:", err);
      addToast(t.sharedChats?.shareError || "Share failed", "error");
    } finally {
      setSharing(false);
    }
  };

  // Upload file thủ công vào thư mục hiện tại
  const handleUploadChange = async (e: any) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const res = await fileService.uploadFile(folderId, file, (pct: number) =>
        setUploadProgress(pct),
      );
      if (res.success) {
        useToastStore
          .getState()
          .addToast(`Đã tải lên "${res.data.name}"`, "success");
        const foldersRes = await folderService.getFolders();
        if (foldersRes.success) setFolders(foldersRes.data);
        setSelectedFile(res.data.id);
      } else {
        useToastStore.getState().addToast("Tải lên thất bại", "error");
      }
    } catch (err) {
      console.error("Lỗi upload file:", err);
      useToastStore.getState().addToast("Tải lên thất bại", "error");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Tóm tắt AI: hiển thị kết quả ngay trong khung chat (nối tiếp luồng hội thoại)
  const handleAiSummary = async (file: any) => {
    if (!file) return;
    const fileName = file.name || "tài liệu";
    const userMsg: MessageProps = {
      id: `msg-sum-${Date.now()}`,
      role: "user",
      content: `Hãy tóm tắt nội dung của tài liệu "${fileName}"`,
    };
    const botMsg: MessageProps = {
      id: `msg-sum-${Date.now() + 1}`,
      role: "bot",
      content: `Đang tóm tắt nội dung của "${fileName}"...`,
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);

    try {
      const res = await aiService.summarizeFile(file.id);
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsg.id
              ? {
                  ...m,
                  content: `### 📝 Tóm tắt AI — ${fileName}\n\n${
                    res.data?.summary || "(AI không trả về nội dung)"
                  }`,
                }
              : m,
          ),
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsg.id
              ? {
                  ...m,
                  content: `Không thể tóm tắt: ${res.message || "lỗi không xác định"}`,
                }
              : m,
          ),
        );
      }
    } catch (err: any) {
      console.error("Lỗi tóm tắt file:", err);
      const msg =
        err?.response?.data?.detail?.message ||
        err?.response?.data?.detail ||
        "Không thể kết nối với dịch vụ AI. Vui lòng thử lại sau!";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsg.id
            ? {
                ...m,
                content: `Lỗi: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`,
              }
            : m,
        ),
      );
    }
  };

  // Lưu nội dung sau khi chỉnh sửa
  const handleSaveContent = async (newContent: string) => {
    if (!selectedFileId) return;

    try {
      const res = await fileService.updateFile(selectedFileId, newContent);
      if (res.success) {
        // Backend chỉ trả về {id, updated_at} → merge vào bản cũ để không mất content/name
        setFileDetails((prev: any) =>
          prev ? { ...prev, ...res.data } : res.data,
        );
      }
    } catch (err) {
      console.error("Lỗi khi cập nhật tài liệu:", err);
    }
  };

  // Kiểm tra chuỗi nhập có phải đường link YouTube không
  const isYoutubeUrl = (text: string) => {
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return youtubeRegex.test(text.trim());
  };

  // Cập nhật tin nhắn trạng thái (status) thay vì thêm mới mỗi lần
  const setStatusMessage = (content: string) => {
    if (statusMsgId.current) {
      setMessages((prev) =>
        prev.map((m) => (m.id === statusMsgId.current ? { ...m, content } : m)),
      );
    } else {
      const id = `msg-${Date.now()}`;
      statusMsgId.current = id;
      setMessages((prev) => [
        ...prev,
        { id, role: "bot", content, isStatus: true },
      ]);
    }
  };

  const clearStatusMessage = () => {
    statusMsgId.current = null;
  };

  const appendBotMessage = (content: string, isStatus?: boolean) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "bot",
        content,
        isStatus,
      },
    ]);
  };

  // Gửi tin nhắn mới hoặc tải file mới lên thư mục hiện tại
  const handleSendMessage = async (message: string, file?: File | null) => {
    // 1. Thêm tin nhắn của User vào ô chat
    const userMsg: MessageProps = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: message,
      fileAttachment: file?.name,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // ─── GỬI QUA API BACKEND (Guest cũng dùng chung luồng này) ───
      if (file) {
        // Tình huống A: Tải file mới lên thư mục hiện tại
        const res = await aiService.digestDocument(file, folderId);
        if (res.success) {
          const botMsg: MessageProps = {
            id: `msg-${Date.now() + 1}`,
            role: "bot",
            content: `Đã xử lý xong tài liệu "${file.name}". Vui lòng bấm chọn file mới vừa xuất hiện trong thư mục ở thanh bên trái!`,
          };
          setMessages((prev) => [...prev, botMsg]);
          // Re-fetch danh sách folder để hiển thị file mới
          const foldersRes = await folderService.getFolders();
          if (foldersRes.success) setFolders(foldersRes.data);
        }
      } else if (isYoutubeUrl(message)) {
        // Tình huống B: Dán link video YouTube mới vào thư mục hiện tại
        const res = await aiService.summarizeYoutube(message, folderId);
        if (res.success) {
          const botMsg: MessageProps = {
            id: `msg-${Date.now() + 1}`,
            role: "bot",
            content: `Đang lấy phụ đề và tóm tắt video. Vui lòng kiểm tra file "${res.data.name || "Video_Summary.md"}" ở Sidebar sau vài giây!`,
          };
          setMessages((prev) => [...prev, botMsg]);
          // Re-fetch folders để đồng bộ
          const foldersRes = await folderService.getFolders();
          if (foldersRes.success) setFolders(foldersRes.data);
        }
      } else {
        // Tình huống C: Hội thoại tiếp diễn / hỏi & chỉnh sửa nội dung cũ trong folder.
        // Giữ nguyên conversation_id = folderId để AI có ngữ cảnh của folder tài liệu này.
        const followUpRes = await aiService.followUpRoadmap(folderId, message);
        const jobId = followUpRes?.data?.job_id;
        if (!jobId) throw new Error("Backend không trả về job_id");

        await aiService.streamFollowUp(jobId, {
          onStatus: (msg: string) => setStatusMessage(msg),
          onAnswer: (text: string) => {
            clearStatusMessage();
            appendBotMessage(text);
          },
          onEdit: (evt: any) => {
            clearStatusMessage();
            appendBotMessage(
              `Đã chỉnh sửa bài học: ${evt.title}\n(File: ${evt.file_id})`,
            );
            // Show toast with clickable link to new file
            if (evt.file_id === "new" || evt.file_id?.startsWith("file-")) {
              addToast(
                `Đã tạo bài học mới: ${evt.title}`,
                "success",
                5000,
                {
                  label: "Mở",
                  onClick: () => {
                    setSelectedFolder(folderId);
                    setSelectedFile(evt.file_id);
                  }
                }
              );
            }
          },
          onCreateSubfolder: async (evt: any) => {
            clearStatusMessage();
            appendBotMessage(
              `Đã tạo thư mục con: ${evt.subfolder_name} (${evt.files?.length || 0} files)`,
            );
            // Show toast with clickable link to new subfolder
            addToast(
              `Đã tạo thư mục con: ${evt.subfolder_name} với ${evt.files?.length || 0} bài học`,
              "success",
              5000,
              {
                label: "Mở thư mục",
                onClick: () => {
                  router.push(`/dashboard/folders/${evt.subfolder_id}`);
                }
              }
            );
            // Refresh folder tree
            const foldersRes = await folderService.getFolders();
            if (foldersRes.success) {
              setFolders(foldersRes.data);
              window.dispatchEvent(new Event("mf-folders-changed"));
            }
          },
          onDone: async () => {
            clearStatusMessage();
            // Re-fetch folders để đồng bộ nội dung bài học đã chỉnh sửa
            const foldersRes = await folderService.getFolders();
            if (foldersRes.success) {
              setFolders(foldersRes.data);
              window.dispatchEvent(new Event("mf-folders-changed"));
            }
          },
          onError: (msg: string) => {
            clearStatusMessage();
            appendBotMessage(msg, true);
          },
        });
      }
    } catch (err) {
      console.error("Lỗi gửi tin nhắn đến AI:", err);
      const botMsg: MessageProps = {
        id: `msg-${Date.now() + 1}`,
        role: "bot",
        content: "Không thể kết nối với dịch vụ AI. Vui lòng thử lại sau!",
        isStatus: true,
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyShareUrl = () => {
    if (!shareResult) return;
    navigator.clipboard.writeText(shareResult.share_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[rgb(var(--color-bg))]">
      {/* Left Pane: Chat Interface (resizable) */}
      <div
        className={`relative flex flex-col shrink-0 h-full ${
          isDocumentSideOpen ? "border-r border-[rgb(var(--color-border))]" : ""
        }`}
        style={{
          width: isDocumentSideOpen ? (isMobile ? 0 : chatPaneWidth) : "100%",
        }}
      >
        {isDocumentSideOpen && !isMobile && (
          <ResizeHandle
            onResize={(delta) => setChatPaneWidth(chatPaneWidth + delta)}
            onResizeEnd={() => setChatPaneWidth(CHAT_PANE_WIDTH_DEFAULT)}
            className="right-0 -mr-1"
          />
        )}

        <div className="p-4 border-b border-[rgb(var(--color-border))] flex items-center justify-between pl-16">
          <h2 className="font-semibold text-lg text-[rgb(var(--color-text-primary))] truncate">
            {folder?.name || "Chat Session"}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleExportFolder}
              disabled={isExporting}
              className="p-1.5 hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-secondary))] rounded-lg transition-colors disabled:opacity-40"
              title="Xuất toàn bộ thư mục ra 1 file Markdown"
              aria-label="Xuất toàn bộ thư mục ra 1 file Markdown"
            >
              {isExporting ? (
                <Loader2 size={20} className="animate-spin text-indigo-400" />
              ) : (
                <Download size={20} />
              )}
            </button>
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={isUploading}
              className="p-1.5 hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-secondary))] rounded-lg transition-colors disabled:opacity-40"
              title="Tải lên file (md/txt) vào thư mục này"
              aria-label="Tải lên file (md/txt) vào thư mục này"
            >
              {isUploading ? (
                uploadProgress > 0 ? (
                  <span className="text-[10px] font-bold text-indigo-400 leading-none min-w-[20px] text-center">
                    {uploadProgress}%
                  </span>
                ) : (
                  <Loader2 size={20} className="animate-spin text-indigo-400" />
                )
              ) : (
                <Upload size={20} />
              )}
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              className="hidden"
              onChange={handleUploadChange}
            />
            <button
              onClick={() => {
                const next = !showMindmap;
                setShowMindmap(next);
                if (next) setDocumentSideOpen(true);
              }}
              className={`p-1.5 hover:bg-[rgb(var(--color-surface-2))] rounded-lg transition-colors ${
                showMindmap && isDocumentSideOpen
                  ? "text-indigo-400 bg-indigo-500/10"
                  : "text-[rgb(var(--color-text-secondary))]"
              }`}
              title={showMindmap ? "Đóng sơ đồ tư duy" : "Xem sơ đồ tư duy"}
              aria-label={
                showMindmap ? "Đóng sơ đồ tư duy" : "Xem sơ đồ tư duy"
              }
            >
              <Network size={20} />
            </button>
            <button
              onClick={toggleDocumentSide}
              className="p-1.5 hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-secondary))] rounded-lg transition-colors"
              title="Bật/Tắt cửa sổ tài liệu"
              aria-label="Bật/Tắt cửa sổ tài liệu"
            >
              {isDocumentSideOpen ? (
                <PanelRightClose size={20} />
              ) : (
                <PanelRight size={20} />
              )}
            </button>
            {/* Share Button - only render after mount to avoid hydration mismatch */}
            {mounted && (
              <button
                onClick={handleShareFolder}
                disabled={sharing || !folder}
                className="p-1.5 hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-secondary))] rounded-lg transition-colors disabled:opacity-40"
                title={t.sharedChats?.shareFolder || "Share folder as chat"}
                aria-label={t.sharedChats?.shareFolder || "Share folder as chat"}
              >
                {sharing ? (
                  <Loader2 size={20} className="animate-spin text-indigo-400" />
                ) : (
                  <Share2 size={20} />
                )}
              </button>
            )}
          </div>
        </div>

        <ChatHistory messages={messages} isLoading={chatHistoryLoading} />

        <div className="p-4 bg-[rgb(var(--color-bg))] border-t border-[rgb(var(--color-border))]">
          <ChatInput
            onSubmit={handleSendMessage}
            isLoading={isLoading}
            placeholder="Đặt câu hỏi hoặc tải lên tài liệu mới..."
          />
        </div>
      </div>

      {/* Right Pane: File Viewer / Mindmap (Collapsible) */}
      <div
        className={`flex flex-col min-w-0 h-full bg-[rgb(var(--color-surface-1))] transition-all duration-300 ease-in-out ${
          isDocumentSideOpen
            ? "flex-1 opacity-100"
            : "w-0 opacity-0 overflow-hidden"
        } ${isDocumentSideOpen && isMobile ? "absolute inset-0 z-30" : ""}`}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-[rgb(var(--color-border))] shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowMindmap(false)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                !showMindmap
                  ? "bg-indigo-600 text-white border-indigo-500"
                  : "text-[rgb(var(--color-text-secondary))] border-[rgb(var(--color-border))] hover:text-indigo-400"
              }`}
            >
              <FileText size={13} />
              Tài liệu
            </button>
            <button
              onClick={() => setShowMindmap(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                showMindmap
                  ? "bg-indigo-600 text-white border-indigo-500"
                  : "text-[rgb(var(--color-text-secondary))] border-[rgb(var(--color-border))] hover:text-indigo-400"
              }`}
            >
              <Network size={13} />
              Sơ đồ tư duy
            </button>
          </div>
          <button
            onClick={toggleDocumentSide}
            className="md:hidden p-1.5 hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-secondary))] rounded-lg transition-colors"
            title="Đóng cửa sổ tài liệu"
            aria-label="Đóng cửa sổ tài liệu"
          >
            <X size={18} />
          </button>
        </div>

        {showMindmap ? (
          <MindmapViewer
            folderId={folderId}
            onOpenLesson={(
              fileId: string,
              query?: string,
              seconds?: number,
            ) => {
              let targetFileId = fileId;

              // 1. Lưu lại mốc thời gian giây (nếu nút trên Mindmap có thông tin này)
              if (typeof seconds === "number" && seconds >= 0) {
                setInitialSeekSeconds(seconds);
              } else {
                setInitialSeekSeconds(null);
              }

              // 2. Tìm fileId nếu là nút concept tổng quát
              if (!targetFileId && query && folder?.files?.length) {
                const queryLower = query.toLowerCase();
                const matched = folder.files.find(
                  (f: any) =>
                    String(f.name || "")
                      .toLowerCase()
                      .includes(queryLower) ||
                    String(f.markdown_content || "")
                      .toLowerCase()
                      .includes(queryLower),
                );
                if (matched) {
                  targetFileId = matched.id;
                }
              }

              // 3. Nếu vẫn chưa tìm được, chọn file đầu tiên
              if (!targetFileId && folder?.files?.length) {
                targetFileId = folder.files[0].id;
              }

              // 4. Highlight từ khóa nếu có
              if (query) {
                useWorkspaceStore.getState().setSearch(query);
              }

              setShowMindmap(false);
              if (targetFileId) {
                setSelectedFile(targetFileId);
              }
              setDocumentSideOpen(true);
            }}
          />
        ) : selectedFileId && loadError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-400"
              >
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" x2="12" y1="9" y2="13" />
                <line x1="12" x2="12.01" y1="17" y2="17" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-[rgb(var(--color-text-primary))]">
                Không thể tải tài liệu
              </h3>
              <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 max-w-xs">
                Có lỗi khi lấy nội dung. Kiểm tra kết nối mạng rồi thử lại.
              </p>
            </div>
            <button
              onClick={() => {
                setFileDetails(null);
                setLoadError(false);
                setFileLoading(true);
                const reload = async () => {
                  try {
                    const res = await fileService.getFile(selectedFileId);
                    if (res.success) {
                      setFileDetails(res.data);
                      setDocumentSideOpen(true);
                    } else {
                      setLoadError(true);
                    }
                  } catch {
                    setLoadError(true);
                  } finally {
                    setFileLoading(false);
                  }
                };
                reload();
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : selectedFileId && (fileLoading || !fileDetails) ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="h-16 border-b border-[rgb(var(--color-border))] px-6 flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-lg bg-[rgb(var(--color-surface-2))] animate-pulse" />
              <div className="space-y-2 flex-1 max-w-md">
                <div className="h-3.5 w-2/3 rounded bg-[rgb(var(--color-surface-2))] animate-pulse" />
                <div className="h-2.5 w-1/2 rounded bg-[rgb(var(--color-surface-2))] animate-pulse" />
              </div>
            </div>
            <div className="flex-1 p-8 space-y-4 overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`h-3 rounded bg-[rgb(var(--color-surface-2))] animate-pulse ${
                    i === 2 ? "w-1/3" : i === 4 ? "w-2/3" : "w-full"
                  }`}
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        ) : selectedFileId && fileDetails ? (
          <FileViewer
            file={fileDetails}
            folderName={folder?.name || ""}
            folderId={folderId}
            initialSeek={initialSeekSeconds}
            onSaveContent={handleSaveContent}
            onAiSummary={handleAiSummary}
            onRestoreContent={(content: string) => {
              setFileDetails((prev: any) =>
                prev ? { ...prev, content } : prev,
              );
              setShowMindmap(false);
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-[rgb(var(--color-text-muted))] p-8 text-center min-w-[300px]">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-[rgb(var(--color-text-primary))]">
                Chưa chọn tài liệu
              </h3>
              <p>
                Hãy chọn một tài liệu từ thanh bên trái (Sidebar) để xem nội
                dung, hoặc bấm nút Sơ đồ tư duy để xem tổng quan toàn bộ bài
                học.
              </p>
            </div>
          </div>
        )}
      </div>

      {showShareModal && shareResult && shareResult.share_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowShareModal(false)}>
          <div className="w-full max-w-lg bg-[rgb(var(--color-surface-1))] rounded-xl border border-[rgb(var(--color-border))] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{t.sharedChats?.shareFolder || "Share Chat"}</h3>
              <button onClick={() => setShowShareModal(false)} className="p-1 hover:bg-[rgb(var(--color-surface-2))] rounded-lg text-[rgb(var(--color-text-muted))] transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-[rgb(var(--color-text-secondary))] mb-2">{t.sharedChats?.copyLink || "Anyone with the link can view"}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareResult.share_url}
                    readOnly
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <button
                    onClick={copyShareUrl}
                    className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors flex items-center gap-2"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    <span>{copied ? (t.sharedChats?.copied || "Copied!") : (t.sharedChats?.copyLink || "Copy link")}</span>
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeChatHistory}
                  onChange={(e) => setIncludeChatHistory(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-[rgb(var(--color-border))] rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-[rgb(var(--color-text-primary))]">{t.sharedChats?.includeChatHistory || "Include chat history"}</span>
              </label>
              <a
                href={shareResult.share_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-lg border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface-2))] text-center flex items-center justify-center gap-2 transition-colors"
              >
                <ExternalLink size={18} />
                {t.sharedChats?.viewOriginal || "View Shared Chat"}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
