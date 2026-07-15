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

  async deleteFile(id) {
    const { data } = await axiosInstance.delete(`/files/${id}`);
    return data;
  },
};
