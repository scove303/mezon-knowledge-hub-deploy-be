'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Greeting from '@/components/chat/Greeting';
import ChatInput from '@/components/chat/ChatInput';
import { useAuthStore } from '@/features/auth/store';
import { useWorkspaceStore } from '@/features/folders/store';
import { folderService } from '@/features/folders/services';
import { aiService } from '@/features/ai/services';
import { useToastStore } from '@/stores/toast';

export default function DashboardIndex() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAuthStore() as any;
  const { setFolders } = useWorkspaceStore() as any;

  // Kiểm tra chuỗi nhập có phải đường link YouTube không
  const isYoutubeUrl = (text: string) => {
    return text.includes('youtube.com/') || text.includes('youtu.be/');
  };

  const handleSubmit = async (message: string, file?: File | null) => {
    setIsLoading(true);
    try {
      // ─── CHẾ ĐỘ THỬ NGHIỆM (GUEST) ───
      if (!isAuthenticated) {
        const folderId = `mock-folder-${Date.now()}`;
        router.push(`/dashboard/folders/${folderId}`);
        return;
      }

      // ─── CHẾ ĐỘ ĐĂNG NHẬP THẬT ───
      let targetFolderId = '';

      if (file) {
        // Tình huống A: Tải file tài liệu
        const folderName = `📄 Tóm tắt ${file.name.replace(/\.[^/.]+$/, "")}`;
        const folderRes = await folderService.createFolder(folderName, 'document');
        if (folderRes.success) {
          targetFolderId = folderRes.data.id;
          await aiService.digestDocument(file, targetFolderId);
        }
      } else if (isYoutubeUrl(message)) {
        // Tình huống B: Nhập link video YouTube
        const folderName = `🎥 Tóm tắt Video YouTube`;
        const folderRes = await folderService.createFolder(folderName, 'video');
        if (folderRes.success) {
          targetFolderId = folderRes.data.id;
          await aiService.summarizeYoutube(message, targetFolderId);
        }
      } else {
        // Tình huống C: Nhập tin nhắn thông thường (Tạo lộ trình học tập)
        const folderName = `🐍 Lộ trình: ${message.slice(0, 20)}${message.length > 20 ? '...' : ''}`;
        
        // GIẢI PHÁP: Vì Backend xử lý ngầm (background_tasks) và chưa tự động ghi folder vào DB ngay lập tức,
        // chúng ta sẽ chủ động tạo folder từ phía Frontend trước để người dùng thấy xuất hiện trên Sidebar,
        // sau đó mới gửi yêu cầu xử lý AI cho folder đó.
        const folderRes = await folderService.createFolder(folderName, 'roadmap');
        if (folderRes.success) {
          targetFolderId = folderRes.data.id;
          await aiService.generateRoadmap(message, folderName);
        }
      }

      // Đồng bộ lại danh sách thư mục của Store để Sidebar hiển thị thư mục mới ngay lập tức
      if (targetFolderId) {
        const foldersRes = await folderService.getFolders();
        if (foldersRes.success) {
          setFolders(foldersRes.data);
        }
        
        // Điều hướng người dùng sang trang phòng chat của thư mục mới
        router.push(`/dashboard/folders/${targetFolderId}`);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Lỗi khi gọi API AI hoặc tạo thư mục:', error);
      useToastStore.getState().addToast('Có lỗi xảy ra trong quá trình xử lý AI. Vui lòng kiểm tra lại kết nối!', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4 md:p-8 overflow-y-auto">
      <div className="w-full max-w-4xl flex flex-col items-center gap-8 mt-[-10vh]">
        <Greeting />
        <div className="w-full">
          <ChatInput 
            onSubmit={handleSubmit} 
            isLoading={isLoading} 
            placeholder="Ask a question, paste a YouTube link, or upload a document..."
          />
        </div>
      </div>
    </div>
  );
}
