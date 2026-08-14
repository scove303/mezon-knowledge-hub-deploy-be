import axiosInstance from '@/libs/axios';

export const fileService = {
  async getFile(id) {
    const { data } = await axiosInstance.get(`/files/${id}`);
    return data;
  },

  async updateFile(id, content) {
    const { data } = await axiosInstance.put(`/files/${id}`, { content });
    return data;
  },

  async renameFile(id, name) {
    const { data } = await axiosInstance.put(`/files/${id}/rename`, { name });
    return data;
  },

  async moveFile(id, folderId) {
    const { data } = await axiosInstance.put(`/files/${id}/move`, { folderId });
    return data;
  },

  async deleteFile(id) {
    const { data } = await axiosInstance.delete(`/files/${id}`);
    return data;
  },

  async uploadFile(folderId, file, onProgress) {
    const formData = new FormData();
    formData.append("folder_id", folderId);
    formData.append("file", file);
    // Content-Type undefined → bỏ header JSON default, browser tự set multipart + boundary
    const { data } = await axiosInstance.post("/files", formData, {
      headers: { "Content-Type": undefined },
      onUploadProgress: onProgress
        ? (e) => {
            if (e.total > 0) onProgress(Math.round((e.loaded / e.total) * 100));
          }
        : undefined,
    });
    return data;
  },

  async listRevisions(id) {
    const { data } = await axiosInstance.get(`/files/${id}/revisions`);
    return data;
  },

  async restoreRevision(id, revisionId) {
    const { data } = await axiosInstance.post(
      `/files/${id}/revisions/${revisionId}/restore`,
    );
    return data;
  },
};
