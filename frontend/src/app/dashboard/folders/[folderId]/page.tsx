"use client"; // Bắt buộc khi sử dụng React hooks

import { useWorkspaceStore, CHAT_PANE_WIDTH_DEFAULT } from '@/features/folders/store';
import { fileService } from '@/features/files/services';
import { folderService } from '@/features/folders/services';
import { aiService } from '@/features/ai/services';
import FileViewer from '@/features/files/components/FileViewer';
import ResizeHandle from '@/components/common/ResizeHandle';
import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ChatHistory from '@/components/chat/ChatHistory';
import ChatInput from '@/components/chat/ChatInput';
import { MessageProps } from '@/components/chat/ChatMessage';
import { PanelRightClose, PanelRight } from 'lucide-react';

export default function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }> | { folderId: string };
}) {
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const folderId = resolvedParams.folderId;
  const router = useRouter();

  const {
    folders,
    selectedFileId,
    setSidebarOpen,
    isDocumentSideOpen,
    setDocumentSideOpen,
    toggleDocumentSide,
    setFolders,
    chatPaneWidth,
    setChatPaneWidth,
  } = useWorkspaceStore() as any;

  const [fileDetails, setFileDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const statusMsgId = useRef<string | null>(null);
  const [messages, setMessages] = useState<MessageProps[]>([
    {
      id: "msg-1",
      role: "bot",
      content:
        "Thư mục tri thức đã được khởi tạo thành công. Bạn có thể xem tài liệu ở khung bên phải, hoặc tải thêm tài liệu/dán link YouTube vào đây để AI tóm tắt thêm vào thư mục này.",
    },
  ]);

  const folder = folders.find((f: any) => f.id === folderId);

  // useEffect (1): Tự động mở Sidebar khi vào phòng chat
  useEffect(() => {
    if (folderId === "default") {
      router.replace("/dashboard");
    } else {
      setSidebarOpen(true);
    }
  }, [folderId, router, setSidebarOpen]);

  // useEffect (2): Tải chi tiết file khi người dùng bấm chọn ở Sidebar
  useEffect(() => {
    async function loadFile() {
      if (!selectedFileId) {
        setFileDetails(null);
        return;
      }

      try {
        const res = await fileService.getFile(selectedFileId);
        if (res.success) {
          setFileDetails(res.data);
          setDocumentSideOpen(true);
        }
      } catch (err) {
        console.error("Lỗi khi tải chi tiết tài liệu:", err);
      }
    }
    loadFile();
  }, [selectedFileId, setDocumentSideOpen]);

  // Lưu nội dung sau khi chỉnh sửa
  const handleSaveContent = async (newContent: string) => {
    if (!selectedFileId) return;

    try {
      const res = await fileService.updateFile(selectedFileId, newContent);
      if (res.success) {
        setFileDetails(res.data);
      }
    } catch (err) {
      console.error("Lỗi khi cập nhật tài liệu:", err);
    }
  };

  // Kiểm tra chuỗi nhập có phải đường link YouTube không
  const isYoutubeUrl = (text: string) => {
    return text.includes("youtube.com/") || text.includes("youtu.be/");
  };

  // Cập nhật tin nhắn trạng thái (status) thay vì thêm mới mỗi lần
  const setStatusMessage = (content: string) => {
    if (statusMsgId.current) {
      setMessages((prev) =>
        prev.map((m) => (m.id === statusMsgId.current ? { ...m, content } : m))
      );
    } else {
      const id = `msg-${Date.now()}`;
      statusMsgId.current = id;
      setMessages((prev) => [...prev, { id, role: "bot", content, isStatus: true }]);
    }
  };

  const clearStatusMessage = () => {
    statusMsgId.current = null;
  };

  const appendBotMessage = (content: string, isStatus?: boolean) => {
    setMessages((prev) => [
      ...prev,
      { id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: "bot", content, isStatus },
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
              `Đã chỉnh sửa bài học: ${evt.title}\n(File: ${evt.file_id})`
            );
          },
          onDone: async () => {
            clearStatusMessage();
            // Re-fetch folders để đồng bộ nội dung bài học đã chỉnh sửa
            const foldersRes = await folderService.getFolders();
            if (foldersRes.success) setFolders(foldersRes.data);
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

  return (
    <div className="flex h-full w-full overflow-hidden bg-[rgb(var(--color-bg))]">
      {/* Left Pane: Chat Interface (resizable) */}
      <div
        className={`relative flex flex-col shrink-0 h-full ${
          isDocumentSideOpen ? "border-r border-[rgb(var(--color-border))]" : ""
        }`}
        style={{ width: isDocumentSideOpen ? chatPaneWidth : "100%" }}
      >
        {isDocumentSideOpen && (
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
          <button
            onClick={toggleDocumentSide}
            className="p-1.5 hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-secondary))] rounded-lg transition-colors"
            title="Bật/Tắt cửa sổ tài liệu"
          >
            {isDocumentSideOpen ? (
              <PanelRightClose size={20} />
            ) : (
              <PanelRight size={20} />
            )}
          </button>
        </div>

        <ChatHistory messages={messages} />

        <div className="p-4 bg-[rgb(var(--color-bg))] border-t border-[rgb(var(--color-border))]">
          <ChatInput
            onSubmit={handleSendMessage}
            isLoading={isLoading}
            placeholder="Đặt câu hỏi hoặc tải lên tài liệu mới..."
          />
        </div>
      </div>

      {/* Right Pane: File Viewer (Collapsible) */}
      <div
        className={`flex flex-col min-w-0 h-full bg-[rgb(var(--color-surface-1))] transition-all duration-300 ease-in-out ${
          isDocumentSideOpen
            ? "flex-1 opacity-100"
            : "w-0 opacity-0 overflow-hidden"
        }`}
      >
        {selectedFileId && fileDetails ? (
          <FileViewer
            file={fileDetails}
            folderName={folder?.name || ""}
            onSaveContent={handleSaveContent}
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
                dung.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
