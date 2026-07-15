import { create } from 'zustand';

export const useWorkspaceStore = create((set, get) => ({
  folders: [],
  selectedFolderId: null,
  selectedFileId: null,
  searchQuery: '',
  isLoading: false,
  error: null,

  // Setters
  setFolders: (folders) => set({ folders }),
  setSelectedFolder: (id) => set({ selectedFolderId: id, selectedFileId: null }),
  setSelectedFile: (id) => set({ selectedFileId: id }),
  setSearch: (query) => set({ searchQuery: query }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Derived getters
  getSelectedFolder: () => {
    const { folders, selectedFolderId } = get();
    return folders.find((f) => f.id === selectedFolderId) || null;
  },
  getSelectedFile: () => {
    const { folders, selectedFolderId, selectedFileId } = get();
    const folder = folders.find((f) => f.id === selectedFolderId);
    return folder?.files?.find((f) => f.id === selectedFileId) || null;
  },
  getFilteredFolders: () => {
    const { folders, searchQuery } = get();
    if (!searchQuery) return folders;
    return folders
      .map((folder) => {
        const matchedFiles = folder.files.filter(
          (file) =>
            file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (file.content || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
        const folderMatches = folder.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        if (folderMatches || matchedFiles.length > 0) {
          return { ...folder, files: matchedFiles.length > 0 ? matchedFiles : folder.files };
        }
        return null;
      })
      .filter(Boolean);
  },
}));
