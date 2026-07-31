import axiosInstance from '@/libs/axios';

export const aiService = {
  // 1. Tạo lộ trình học từ Internet (Prompt-to-Folder)
  async generateRoadmap(topic, folderName) {
    // API yêu cầu gửi JSON body: { topic, folder_name }
    // Backend sinh 10-12 bài học tuần tự bằng Gemini nên có thể mất vài phút → timeout dài
    const { data } = await axiosInstance.post('/ai/roadmap', {
      topic,
      folder_name: folderName
    }, { timeout: 600000 });
    return data;
  },

  // 2. Tóm tắt video Youtube (Video-to-Markdown)
  async summarizeYoutube(url, folderId) {
    // API yêu cầu gửi dưới dạng query parameters: /ai/youtube?url=...&folder_id=...
    const { data } = await axiosInstance.post('/ai/youtube', null, {
      params: { url, folder_id: folderId }
    });
    return data;
  },

  // 3. Tiêu hóa tài liệu đính kèm (Doc-to-Summary)
  async digestDocument(file, folderId) {
    // API yêu cầu gửi dưới dạng multipart/form-data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder_id', folderId);

    const { data } = await axiosInstance.post('/ai/digest', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  }
};
