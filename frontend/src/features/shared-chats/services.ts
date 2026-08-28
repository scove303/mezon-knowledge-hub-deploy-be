import axiosInstance from "@/libs/axios";

// Helper to unwrap axios response (backend returns { success, message, data })
function unwrap(res: any) {
  const data = res?.data;
  if (data?.success && data?.data) {
    return data.data;
  }
  return data ?? res;
}

export const sharedChatService = {
  // Share a folder as a chat
  async shareChat(payload) {
    const res = await axiosInstance.post("/shared-chats", payload);
    return unwrap(res);
  },

  // Get public shared chats
  async getPublicChats(limit = 20, offset = 0) {
    const res = await axiosInstance.get("/shared-chats/public", {
      params: { limit, offset },
    });
    return unwrap(res);
  },

  // Get current user's shared chats
  async getMySharedChats() {
    const res = await axiosInstance.get("/shared-chats/my");
    return unwrap(res);
  },

  // Get shared chat detail by share code
  async getSharedChat(shareCode) {
    const res = await axiosInstance.get(`/shared-chats/${shareCode}`);
    return unwrap(res);
  },

  // Import a shared chat
  async importChat(shareCode, newFolderName) {
    const res = await axiosInstance.post("/shared-chats/import", {
      share_code: shareCode,
      new_folder_name: newFolderName,
    });
    return unwrap(res);
  },

  // Delete own shared chat
  async deleteSharedChat(chatId) {
    const res = await axiosInstance.delete(`/shared-chats/${chatId}`);
    return unwrap(res);
  },
};

// Types for TypeScript
export interface SharedChat {
  id: string;
  share_code: string;
  title: string;
  description?: string;
  topic: string;
  creator_username: string;
  creator_display_name?: string;
  is_public: boolean;
  import_count: number;
  view_count: number;
  created_at: string;
  expires_at?: string;
  share_url: string;
}

export interface SharedChatDetail extends SharedChat {
  folder_snapshot: {
    name: string;
    type: string;
    files: Array<{
      id: string;
      name: string;
      markdown_content: string;
      summary: string;
      video_url?: string;
      timestamps_json?: string;
      order_index: number;
    }>;
  };
  conversation_history: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
}

export interface ImportChatResponse {
  folder_id: string;
  folder_name: string;
  files_count: number;
  message: string;
}