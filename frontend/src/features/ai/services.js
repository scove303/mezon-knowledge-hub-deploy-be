import axiosInstance, { getTokens } from '@/libs/axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function buildAuthHeaders() {
  const headers = {};
  const { accessToken } = getTokens();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

async function readSSEStream(url, headers, onEvent, { signal, timeout = 300000 } = {}) {
  const controller = new AbortController();
  const timer = timeout ? setTimeout(() => controller.abort(new Error("Stream timeout")), timeout) : null;

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }
  }

  try {
    const res = await fetch(url, { headers, signal: controller.signal });

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

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

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

          const shouldStop = onEvent(event);
          if (shouldStop) return;
        }
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const aiService = {
  // 1. Tạo lộ trình học từ Internet (Prompt-to-Folder) — trả job_id ngay lập tức
  async generateRoadmap(topic, folderName) {
    const { data } = await axiosInstance.post('/ai/roadmap', {
      topic,
      folder_name: folderName
    }, { timeout: 120000 });
    return data;
  },

  // 1b. Lấy trạng thái job (fallback khi SSE lỗi)
  async getRoadmapStatus(jobId) {
    const { data } = await axiosInstance.get(`/ai/roadmap/${jobId}`, { timeout: 60000 });
    return data;
  },

  // 1c. Stream sự kiện tiến trình của job qua SSE (fetch-based để gửi được custom header)
  async streamRoadmap(jobId, callbacks = {}, options = {}) {
    const { onStatus, onOutline, onLesson, onDone, onError } = callbacks;
    const headers = buildAuthHeaders();

    await readSSEStream(
      `${BASE_URL}/ai/roadmap/${jobId}/stream`,
      headers,
      (event) => {
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
            return true; // Stop reading
          case "error":
            onError?.(event.message);
            return true; // Stop reading
        }
        return false;
      },
      options
    );
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
  },

  // 3b. Tóm tắt nội dung một file/bài học đang mở
  async summarizeFile(fileId) {
    const { data } = await axiosInstance.post(`/ai/files/${fileId}/summarize`, null, { timeout: 60000 });
    return data;
  },

  // 4. Prompt hỏi tiếp / chỉnh sửa nội dung cũ (giữ conversation_id = folder_id cũ)
  async followUpRoadmap(conversationId, topic, folderName) {
    const { data } = await axiosInstance.post('/ai/roadmap/followup', {
      conversation_id: conversationId,
      topic,
      folder_name: folderName || undefined,
    }, { timeout: 120000 });
    return data;
  },

  // 4b. Stream kết quả follow-up (answer / edit) qua SSE
  async streamFollowUp(jobId, callbacks = {}, options = {}) {
    const { onStatus, onAnswer, onEdit, onCreateSubfolder, onDone, onError } = callbacks;
    const headers = buildAuthHeaders();

    await readSSEStream(
      `${BASE_URL}/ai/roadmap/${jobId}/stream`,
      headers,
      (event) => {
        switch (event.type) {
          case "status":
            onStatus?.(event.message);
            break;
          case "answer":
            onAnswer?.(event.text);
            break;
          case "edit":
            onEdit?.(event);
            break;
          case "create_subfolder":
            onCreateSubfolder?.(event);
            break;
          case "done":
            onDone?.(event);
            return true;
          case "error":
            onError?.(event.message);
            return true;
        }
        return false;
      },
      options
    );
  }
};
