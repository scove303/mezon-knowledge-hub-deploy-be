// src/mocks/mockServices.ts

import {
  MOCK_FOLDERS,
  MOCK_FILES_DETAIL,
  MOCK_REVISONS,
  FileDetailItem,
  RevisionItem,
} from "./DATA_MOCK";

const INIT_STORAGE_KEY = "mf_mock_initialized_v1";

function initializeMockStorage(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(INIT_STORAGE_KEY)) {
    localStorage.setItem("mf_folders", JSON.stringify(MOCK_FOLDERS));
    localStorage.setItem("mf_files", JSON.stringify(MOCK_FILES_DETAIL));
    localStorage.setItem("mf_revisions", JSON.stringify(MOCK_REVISONS));
    localStorage.setItem(INIT_STORAGE_KEY, "true");
  }
}

initializeMockStorage();

const delay = (ms = 150): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const mockFileService = {
  async getFileDetail(
    fileId: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: FileDetailItem | null;
  }> {
    await delay();
    const filesMap = JSON.parse(localStorage.getItem("mf_files") || "{}");
    const file = filesMap[fileId] || null;
    return {
      success: !!file,
      message: file ? "Lấy file thành công" : "Không tìm thấy file",
      data: file,
    };
  },

  async listRevisions(
    fileId: string,
  ): Promise<{ success: boolean; message: string; data: RevisionItem[] }> {
    await delay();
    const revisionsMap = JSON.parse(
      localStorage.getItem("mf_revisions") || "{}",
    );
    const list = revisionsMap[fileId] || [];
    return {
      success: true,
      message: "Lấy lịch sử phiên bản thành công",
      data: list,
    };
  },

  async restoreRevision(
    fileId: string,
    revisionId: string,
  ): Promise<{ success: boolean; message: string; data: { content: string } }> {
    await delay();
    const revisionsMap = JSON.parse(
      localStorage.getItem("mf_revisions") || "{}",
    );
    const filesMap = JSON.parse(localStorage.getItem("mf_files") || "{}");

    const fileRevisions = revisionsMap[fileId] || [];
    const targetRev = fileRevisions.find(
      (r: RevisionItem) => r.id === revisionId,
    );

    if (!targetRev) {
      return {
        success: false,
        message: "Không tìm thấy phiên bản",
        data: { content: "" },
      };
    }

    if (filesMap[fileId]) {
      filesMap[fileId].content = targetRev.content;
      localStorage.setItem("mf_files", JSON.stringify(filesMap));
    }

    return {
      success: true,
      message: "Khôi phục phiên bản thành công",
      data: { content: targetRev.content },
    };
  },

  async updateFile(
    fileId: string,
    content: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: { id: string; updated_at: string };
  }> {
    await delay();
    const filesMap = JSON.parse(localStorage.getItem("mf_files") || "{}");
    if (filesMap[fileId]) {
      filesMap[fileId].content = content;
      localStorage.setItem("mf_files", JSON.stringify(filesMap));
    }

    return {
      success: true,
      message: "Đã cập nhật nội dung tài liệu",
      data: { id: fileId, updated_at: new Date().toISOString() },
    };
  },

  async deleteFile(
    fileId: string,
  ): Promise<{ success: boolean; message: string; data: null }> {
    await delay();
    const filesMap = JSON.parse(localStorage.getItem("mf_files") || "{}");
    delete filesMap[fileId];
    localStorage.setItem("mf_files", JSON.stringify(filesMap));
    return { success: true, message: "Xóa file thành công", data: null };
  },
};
