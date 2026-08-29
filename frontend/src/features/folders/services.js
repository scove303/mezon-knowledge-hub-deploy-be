import axiosInstance from "@/libs/axios";

export const folderService = {
  async getFolders() {
    try {
      const { data } = await axiosInstance.get("/folders");
      return data;
    } catch (err) {
      console.log(`Error: ${err}`);
      return [];
    }
  },

  async createFolder(name, type = "general") {
    const { data } = await axiosInstance.post("/folders", { name, type });
    return data;
  },

  async deleteFolder(id) {
    const { data } = await axiosInstance.delete(`/folders/${id}`);
    return data;
  },

  async renameFolder(id, name) {
    const { data } = await axiosInstance.put(`/folders/${id}`, { name });
    return data;
  },

  async reorderFolders(folderIds) {
    const { data } = await axiosInstance.put("/folders/reorder", { folder_ids: folderIds });
    return data;
  },

  async getChatHistory(folderId) {
    try {
      console.log('[folderService] Getting chat history for:', folderId);
      const { data } = await axiosInstance.get(`/folders/${folderId}/chat-history`);
      console.log('[folderService] Chat history response:', data);
      return data;
    } catch (err) {
      console.log(`[folderService] Error getting chat history: ${err}`);
      return { success: false, data: [] };
    }
  },

  async saveChatHistory(folderId, messages) {
    try {
      console.log('[folderService] Saving chat history for:', folderId, 'messages:', messages.length);
      const { data } = await axiosInstance.put(`/folders/${folderId}/chat-history`, { messages });
      console.log('[folderService] Save chat history response:', data);
      return data;
    } catch (err) {
      console.log(`[folderService] Error saving chat history: ${err}`);
      return { success: false };
    }
  },
};
