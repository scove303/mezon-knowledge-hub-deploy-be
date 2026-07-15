import axiosInstance from '@/libs/axios';

export const folderService = {
  async getFolders() {
    const { data } = await axiosInstance.get('/folders');
    return data;
  },

  async createFolder(name, type = 'general') {
    const { data } = await axiosInstance.post('/folders', { name, type });
    return data;
  },

  async deleteFolder(id) {
    const { data } = await axiosInstance.delete(`/folders/${id}`);
    return data;
  },
};
