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
};
