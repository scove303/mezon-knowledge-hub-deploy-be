import axiosInstance, { getTokens, getGuestId } from '@/libs/axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function buildAuthHeaders() {
  const headers = {};
  const { accessToken } = getTokens();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else {
    const guestId = getGuestId();
    if (guestId) {
      headers["X-Guest-Id"] = guestId;
    }
  }
  return headers;
}

export const aiService = {
  // 1. Tạo lộ trình học từ Internet (Prompt-to-Folder) — trả job_id ngay lập tức
  async generateRoadmap(topic, folderName) {
    const { data } = await axiosInstance.post('/ai/roadmap', {
      topic,
      folder_name: folderName
    }, { timeout: 20000 });
    return data;
  },

  // 1b. Lấy trạng thái job (fallback khi SSE lỗi)
  async getRoadmapStatus(jobId) {
    const { data } = await axiosInstance.get(`/ai/roadmap/${jobId}`, { timeout: 15000 });
    return data;
  },

  // 1c. Stream sự kiện tiến trình của job qua SSE (fetch-based để gửi được custom header)
  async streamRoadmap(jobId, callbacks = {}) {
    const { onStatus, onOutline, onLesson, onDone, onError } = callbacks;
    const headers = buildAuthHeaders();

    const res = await fetch(`${BASE_URL}/ai/roadmap/${jobId}/stream`, { headers });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body.detail?.message || body.detail || detail;
      } catch { /* ignore */ }
      throw new Error(detail);
    }

    if (!res.body) throw new Error("Trình duyệt không hỗ trợ streaming");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events cách nhau bởi dòng trống
      let sepIdx;
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;

        let event;
        try {
          event = JSON.parse(dataLine.slice(5).trim());
        } catch {
          continue;
        }

        switch (event.type) {
          case "status":
            onStatus?.(event.message);
            break;
          case "outline":
            onOutline?.(event.total);
            break;
          case "lesson":
            onLesson?.(event);
            break;
          case "done":
            onDone?.(event);
            return;
          case "error":
            onError?.(event.message);
            return;
        }
      }
    }
  },

  // 2. Tóm tắt video Youtube (Video-to-Markdown)
  async summarizeYoutube(url, folderId) {
    const { data } = await axiosInstance.post('/ai/youtube', null, {
      params: { url, folder_id: folderId }
    });
    return data;
  },

  // 3. Tiêu hóa tài liệu đính kèm (Doc-to-Summary)
  async digestDocument(file, folderId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder_id', folderId);

    const { data } = await axiosInstance.post('/ai/digest', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  }
};
