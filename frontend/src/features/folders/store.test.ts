import { describe, it, expect, beforeEach } from "vitest";
import {
  useWorkspaceStore,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
} from "./store";

const sampleFolders = [
  {
    id: "f1",
    name: "Python Roadmap",
    type: "roadmap",
    files: [
      { id: "file-1", name: "Tong_quan.md", content: "# Lộ trình Python" },
      { id: "file-2", name: "Bai_tap.md", content: "bài tập" },
    ],
  },
  {
    id: "f2",
    name: "AI Agents",
    type: "document",
    files: [
      { id: "file-3", name: "Action_Items.md", content: "kế hoạch hành động" },
    ],
  },
];

beforeEach(() => {
  useWorkspaceStore.setState({
    folders: sampleFolders,
    searchQuery: "",
    selectedFolderId: null,
    selectedFileId: null,
  });
  localStorage.clear();
});

describe("getFilteredFolders", () => {
  it("trả về toàn bộ folder khi không có từ khóa", () => {
    const res = useWorkspaceStore.getState().getFilteredFolders();
    expect(res).toHaveLength(2);
  });

  it("lọc theo tên folder (không phân biệt hoa thường)", () => {
    useWorkspaceStore.getState().setSearch("python");
    const res = useWorkspaceStore.getState().getFilteredFolders();
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("f1");
  });

  it("lọc theo tên file", () => {
    useWorkspaceStore.getState().setSearch("action");
    const res = useWorkspaceStore.getState().getFilteredFolders();
    expect(res).toHaveLength(1);
    expect(res[0].files.map((f) => f.id)).toEqual(["file-3"]);
  });

  it("lọc theo nội dung file", () => {
    useWorkspaceStore.getState().setSearch("kế hoạch");
    const res = useWorkspaceStore.getState().getFilteredFolders();
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("f2");
  });

  it("không trả về folder nào khi không khớp", () => {
    useWorkspaceStore.getState().setSearch("không tồn tại");
    const res = useWorkspaceStore.getState().getFilteredFolders();
    expect(res).toHaveLength(0);
  });
});

describe("selection", () => {
  it("chọn folder sẽ reset file đang chọn", () => {
    useWorkspaceStore.getState().setSelectedFile("file-1");
    useWorkspaceStore.getState().setSelectedFolder("f2");
    const s = useWorkspaceStore.getState();
    expect(s.selectedFolderId).toBe("f2");
    expect(s.selectedFileId).toBeNull();
  });

  it("getSelectedFile trả về đúng file đã chọn", () => {
    useWorkspaceStore.getState().setSelectedFolder("f1");
    useWorkspaceStore.getState().setSelectedFile("file-2");
    const file = useWorkspaceStore.getState().getSelectedFile();
    expect(file?.id).toBe("file-2");
    expect(file?.name).toBe("Bai_tap.md");
  });
});

describe("sidebar width", () => {
  it("clamp theo min/max khi set kích thước", () => {
    useWorkspaceStore.getState().setSidebarWidth(10);
    expect(useWorkspaceStore.getState().sidebarWidth).toBe(SIDEBAR_WIDTH_MIN);

    useWorkspaceStore.getState().setSidebarWidth(9999);
    expect(useWorkspaceStore.getState().sidebarWidth).toBe(SIDEBAR_WIDTH_MAX);
  });

  it("persist kích thước vào localStorage", () => {
    useWorkspaceStore.getState().setSidebarWidth(400);
    expect(localStorage.getItem("mf-sidebar-width")).toBe("400");
  });
});