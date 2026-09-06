import { create } from "zustand";

// Đọc kích thước panel đã lưu (nếu có), nếu không dùng mặc định
const readStored = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const val = parseFloat(localStorage.getItem(key));
    return Number.isFinite(val) && val > 0 ? val : fallback;
  } catch {
    return fallback;
  }
};

export const SIDEBAR_WIDTH_MIN = 240;
export const SIDEBAR_WIDTH_MAX = 480;
export const SIDEBAR_WIDTH_DEFAULT = 320;

export const CHAT_PANE_WIDTH_MIN = 320;
export const CHAT_PANE_WIDTH_MAX = 900;
export const CHAT_PANE_WIDTH_DEFAULT = 520;

export const useWorkspaceStore = create((set, get) => ({
  folders: [],
  selectedFolderId: null,
  selectedFileId: null,
  // Multiselect: danh sách file đang chọn (bulk delete)
  selectedFileIds: [],
  searchQuery: "",
  isLoading: false,
  error: null,

  // Chat History State
  chatHistoryByFolderId: {},

  // Layout State
  isSidebarOpen: false,
  isDocumentSideOpen: false,
  sidebarWidth: readStored("mf-sidebar-width", SIDEBAR_WIDTH_DEFAULT),
  chatPaneWidth: readStored("mf-chatpane-width", CHAT_PANE_WIDTH_DEFAULT),

  // Setters
  setFolders: (folders) => set({ folders }),
  setSelectedFolder: (id) =>
    set({ selectedFolderId: id, selectedFileId: null }),
  setSelectedFile: (id) => set({ selectedFileId: id }),
  setSearch: (query) => set({ searchQuery: query }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setFolderOrder: (folderIds) =>
    set((state) => {
      const folderMap = new Map(state.folders.map((f) => [f.id, f]));
      const reordered = folderIds
        .map((id) => folderMap.get(id))
        .filter(Boolean);
      const remaining = state.folders.filter((f) => !folderIds.includes(f.id));
      return { folders: [...reordered, ...remaining] };
    }),

  // Chat History Setters
  setChatHistory: (folderId, messages) =>
    set((state) => ({
      chatHistoryByFolderId: {
        ...state.chatHistoryByFolderId,
        [folderId]: messages,
      },
    })),
  getChatHistory: (folderId) => {
    const { chatHistoryByFolderId } = get();
    return chatHistoryByFolderId[folderId] || [];
  },

  // Multiselect Setters
  toggleFileSelection: (id) =>
    set((state) => ({
      selectedFileIds: state.selectedFileIds.includes(id)
        ? state.selectedFileIds.filter((x) => x !== id)
        : [...state.selectedFileIds, id],
    })),
  clearFileSelection: () => set({ selectedFileIds: [] }),

  // Layout Setters
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  toggleDocumentSide: () =>
    set((state) => ({ isDocumentSideOpen: !state.isDocumentSideOpen })),
  setDocumentSideOpen: (isOpen) => set({ isDocumentSideOpen: isOpen }),

  // Resize panel setters (kèm clamp min/max + persist)
  setSidebarWidth: (width) =>
    set(() => {
      const clamped = Math.min(
        SIDEBAR_WIDTH_MAX,
        Math.max(SIDEBAR_WIDTH_MIN, width),
      );
      try {
        localStorage.setItem("mf-sidebar-width", String(clamped));
      } catch { /* ignore */ }
      return { sidebarWidth: clamped };
    }),
  setChatPaneWidth: (width) =>
    set(() => {
      const clamped = Math.min(
        CHAT_PANE_WIDTH_MAX,
        Math.max(CHAT_PANE_WIDTH_MIN, width),
      );
      try {
        localStorage.setItem("mf-chatpane-width", String(clamped));
      } catch { /* ignore */ }
      return { chatPaneWidth: clamped };
    }),

  // Derived getters (hỗ trợ đệ quy cho cả subfolder / cây thư mục lồng nhau)
  getSelectedFolder: () => {
    const { folders, selectedFolderId } = get();
    if (!selectedFolderId) return null;
    const findFolder = (list) => {
      for (const f of list || []) {
        if (f.id === selectedFolderId) return f;
        if (f.children && f.children.length > 0) {
          const found = findFolder(f.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findFolder(folders);
  },
  getSelectedFile: () => {
    const { selectedFileId } = get();
    if (!selectedFileId) return null;
    const folder = get().getSelectedFolder();
    return folder?.files?.find((f) => f.id === selectedFileId) || null;
  },
  getFilteredFolders: () => {
    const { folders, searchQuery } = get();
    if (!searchQuery) return folders;

    const filterFolder = (folder) => {
      const matchedFiles = (folder.files || []).filter(
        (file) =>
          file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (file.content || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
      const filteredChildren = (folder.children || [])
        .map(filterFolder)
        .filter(Boolean);

      const folderMatches = (folder.name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      if (folderMatches || matchedFiles.length > 0 || filteredChildren.length > 0) {
        return {
          ...folder,
          files: matchedFiles.length > 0 ? matchedFiles : folder.files,
          children: filteredChildren,
        };
      }
      return null;
    };

    return folders.map(filterFolder).filter(Boolean);
  },
}));
