'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Greeting from '@/components/chat/Greeting';
import ChatInput from '@/components/chat/ChatInput';
import { useWorkspaceStore } from '@/features/folders/store';
import { folderService } from '@/features/folders/services';
import { aiService } from '@/features/ai/services';
import { useToastStore } from '@/stores/toast';
import { useAuthStore } from '@/features/auth/store';

function GuestBanner() {
  const isAuthenticated = useAuthStore((s: any) => s.isAuthenticated);
  if (isAuthenticated) return null;
  return (
    <div className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
      <span>Bạn đang dùng chế độ Khách. Dữ liệu sẽ được tự động chuyển sang tài khoản khi bạn</span>
      <Link href="/login" className="font-semibold underline hover:text-indigo-200">
        đăng nhập
      </Link>
      .
    </div>
  );
}

export default function DashboardIndex() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { setFolders } = useWorkspaceStore() as any;

  // Kiểm tra chuỗi nhập có phải đường link YouTube không
  const isYoutubeUrl = (text: string) => {
    return text.includes('youtube.com/') || text.includes('youtu.be/');
  };

  const handleSubmit = async (message: string, file?: File | null) => {
    setIsLoading(true);
    try {
      // Guest và user đều dùng chung luồng API (backend định danh bằng X-Guest-Id)
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
        
        // Backend tự tạo folder duy nhất khi sinh lộ trình và trả về folder_id trong response.
        // Không tạo folder trước ở Frontend nữa để tránh tạo ra 2 folder trùng lặp.
        const roadmapRes = await aiService.generateRoadmap(message, folderName);
        const folderId = roadmapRes?.data?.folder_id;
        if (folderId) {
          targetFolderId = folderId;
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
        <GuestBanner />
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
