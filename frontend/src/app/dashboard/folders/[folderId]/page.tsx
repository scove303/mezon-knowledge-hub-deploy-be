"use client"; // Bắt buộc trong Next.js (App Router) khi file có sử dụng state (useState), effect (useEffect), hoặc các sự kiện (onClick).

import { useWorkspaceStore } from "@/features/folders/store";
import { fileService } from "@/features/files/services";
import FileViewer from "@/features/files/components/FileViewer";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import ChatHistory from "@/components/chat/ChatHistory";
import ChatInput from "@/components/chat/ChatInput";
import { MessageProps } from "@/components/chat/ChatMessage";
import { PanelRightClose, PanelRight } from "lucide-react";

export default function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }> | { folderId: string };
}) {
  // lấy folderId từ đường dẫn URL, ví dụ: /dashboard/folders/123 -> folderId là '123')
  const resolvedParams = params instanceof Promise ? use(params) : params;
  const folderId = resolvedParams.folderId;

  // useRouter dùng để điều hướng trang (chuyển hướng URL)
  const router = useRouter();

  // Lấy các state và function từ Zustand store (giống như kho lưu trữ dữ liệu dùng chung cho toàn bộ app)
  const {
    folders,
    selectedFileId,
    setSidebarOpen,
    isDocumentSideOpen,
    setDocumentSideOpen,
    toggleDocumentSide,
  } = useWorkspaceStore() as any;

  const [fileDetails, setFileDetails] = useState<any>(null); // Lưu trữ chi tiết nội dung của file đang mở
  const [isLoading, setIsLoading] = useState(false); // Trạng thái đang tải (hiển thị spinner hoặc vô hiệu hóa nút bấm)

  // Lưu trữ danh sách tin nhắn của ô chat
  const [messages, setMessages] = useState<MessageProps[]>([
    {
      id: "msg-1",
      role: "bot",
      content:
        "I have generated the knowledge hub folder for you. Let me know if you need any adjustments.",
    },
  ]);

  // useEffect (1): Chạy mỗi khi `folderId`, `router` hoặc `setSidebarOpen` thay đổi.
  // Dùng để xử lý logic khi mới vào trang (chuyển hướng hoặc mở sidebar).
  useEffect(() => {
    // Nếu vô tình vào URL cũ là 'default', chuyển hướng ngay lập tức về trang chủ Dashboard
    if (folderId === "default") {
      router.replace("/dashboard");
    } else {
      // Tự động mở thanh Sidebar bên trái khi người dùng vào phòng chat này
      setSidebarOpen(true);
    }
  }, [folderId, router, setSidebarOpen]);

  // Tìm thư mục hiện tại và tóm tắt file từ trong mảng folders (dữ liệu lấy từ Store)
  const folder = folders.find((f: any) => f.id === folderId);
  const fileSummary = folder?.files?.find((f: any) => f.id === selectedFileId);

  // useEffect (2): Lắng nghe sự thay đổi của `selectedFileId`.
  // Mỗi khi người dùng bấm chọn một file khác ở Sidebar, biến selectedFileId sẽ thay đổi, kéo theo hàm bên dưới được gọi.
  useEffect(() => {
    async function loadFile() {
      // Nếu chưa chọn file nào, xóa thông tin file hiện tại trên giao diện và dừng hàm
      if (!selectedFileId) {
        setFileDetails(null);
        return;
      }

      try {
        // Gọi API backend để lấy chi tiết nội dung của file
        const res = await fileService.getFile(selectedFileId);
        if (res.success) {
          setFileDetails(res.data); // Cập nhật state fileDetails
          setDocumentSideOpen(true); // Tự động mở cửa sổ bên phải (Document Viewer) để đọc nội dung
        }
      } catch (err) {
        console.error("Lỗi khi lấy dữ liệu file:", err);
      }
    }

    loadFile();
  }, [selectedFileId, setDocumentSideOpen]);

  // Hàm xử lý lưu lại nội dung sau khi người dùng sửa file (VD: Edit Markdown)
  const handleSaveContent = async (newContent: string) => {
    if (!selectedFileId) return;
    try {
      const res = await fileService.updateFile(selectedFileId, newContent);
      if (res.success) {
        setFileDetails(res.data);
      }
    } catch (err) {
      console.error("Lỗi khi lưu file:", err);
    }
  };

  // Hàm xử lý khi người dùng gõ phím Enter hoặc bấm nút Gửi tin nhắn
  const handleSendMessage = (message: string, file?: File | null) => {
    // 1. Tạo tin nhắn của người dùng và thêm vào danh sách
    const userMsg: MessageProps = {
      id: `msg-${Date.now()}`, // Tạo ID ngẫu nhiên bằng thời gian hiện tại
      role: "user",
      content: message,
      fileAttachment: file?.name, // Tên file đính kèm nếu có
    };

    // setMessages nhận vào một callback để đảm bảo lấy được mảng cũ (prev), sau đó nối tin nhắn mới vào cuối
    setMessages((prev) => [...prev, userMsg]);

    // 2. Chuyển trạng thái đang xử lý để khóa nút Gửi
    setIsLoading(true);

    // TODO: Đây chỉ là mô phỏng (fake) thời gian đợi AI.
    // Sau này sẽ thay setTimeout bằng việc gọi api fetch/axios gửi dữ liệu lên Backend ở đây
    setTimeout(() => {
      const botMsg: MessageProps = {
        id: `msg-${Date.now() + 1}`,
        role: "bot",
        content: "I am processing your request and updating the document...",
        isStatus: true,
      };

      setMessages((prev) => [...prev, botMsg]); // Cập nhật tin nhắn của Bot vào mảng
      setIsLoading(false); // Xong thì tắt trạng thái loading

      // Giả lập việc mở cửa sổ tài liệu bên phải sau khi Bot phản hồi xong
      setDocumentSideOpen(true);
    }, 1000); // Đợi 1 giây (1000ms)
  };

  // Tránh render giao diện nếu URL là 'default' (vì đang chuẩn bị bị redirect đi chỗ khác)
  if (folderId === "default") {
    return null;
  }

  // --- GIAO DIỆN (JSX) ---
  return (
    <div className="flex h-full w-full overflow-hidden bg-[rgb(var(--color-bg))]">
      {/* ---------------------------------------------------- */}
      {/* KHUNG BÊN TRÁI: Ô Chat (Left Pane)                    */}
      {/* ---------------------------------------------------- */}
      <div
        className={`flex flex-col shrink-0 transition-all duration-300 ease-in-out h-full ${
          // Nếu khung bên phải (isDocumentSideOpen) ĐANG MỞ, khung bên trái chỉ chiếm 1/3 màn hình.
          // Ngược lại, nếu khung bên phải ĐANG ĐÓNG, khung bên trái sẽ mở rộng 100% (w-full).
          isDocumentSideOpen
            ? "w-full lg:w-1/3 xl:w-2/5 border-r border-[rgb(var(--color-border))]"
            : "w-full"
        }`}
      >
        {/* Tiêu đề ô chat */}
        <div className="p-4 border-b border-[rgb(var(--color-border))] flex items-center justify-between pl-16">
          <h2 className="font-semibold text-lg text-[rgb(var(--color-text-primary))] truncate">
            {folder?.name || "Chat Session"}
          </h2>

          {/* Nút bấm để Bật/Tắt khung Tài liệu bên phải */}
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

        {/* Component hiển thị Lịch sử chat (đẩy mảng messages vào qua props) */}
        <ChatHistory messages={messages} />

        {/* Component chứa Ô nhập liệu (Chat Input) */}
        <div className="p-4 bg-[rgb(var(--color-bg))] border-t border-[rgb(var(--color-border))]">
          <ChatInput
            onSubmit={handleSendMessage}
            isLoading={isLoading}
            placeholder="Đặt câu hỏi hoặc yêu cầu chỉnh sửa..."
          />
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* KHUNG BÊN PHẢI: Trình xem tài liệu (Right Pane)        */}
      {/* ---------------------------------------------------- */}
      <div
        className={`flex flex-col min-w-0 h-full bg-[rgb(var(--color-surface-1))] transition-all duration-300 ease-in-out ${
          // Hiệu ứng ẩn/hiện: Nếu isDocumentSideOpen là true thì cho độ rộng flex-1 (chiếm phần còn lại).
          // Nếu false thì cho chiều rộng = 0 (w-0) và ẩn đi (opacity-0).
          isDocumentSideOpen
            ? "flex-1 opacity-100"
            : "w-0 opacity-0 overflow-hidden"
        }`}
      >
        {/* Kiểm tra (Conditional Rendering): Nếu người dùng ĐÃ chọn file và file ĐÃ tải xong dữ liệu */}
        {selectedFileId && fileDetails ? (
          // Hiển thị Component đọc file (Markdown / Video)
          <FileViewer
            file={fileDetails}
            folderName={folder?.name || ""}
            onSaveContent={handleSaveContent}
          />
        ) : (
          // Nếu CHƯA chọn file nào, hiển thị màn hình hướng dẫn (Empty State)
          <div className="flex-1 flex items-center justify-center text-[rgb(var(--color-text-muted))] p-8 text-center min-w-[300px]">
            <div className="flex flex-col items-center gap-4">
              {/* Icon minh họa */}
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
