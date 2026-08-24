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
};
