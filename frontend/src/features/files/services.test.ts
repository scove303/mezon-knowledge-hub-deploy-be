import { describe, it, expect, vi, beforeEach } from "vitest";
import axiosInstance from "@/libs/axios";
import { fileService } from "./services";
import { folderService } from "@/features/folders/services";

vi.mock("@/libs/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mocked = vi.mocked(axiosInstance);

describe("fileService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renameFile gọi PUT /files/:id/rename với tên mới", async () => {
    mocked.put.mockResolvedValue({
      data: { success: true, data: { id: "f1", name: "x.md" } },
    });
    const res = await fileService.renameFile("f1", "x.md");
    expect(mocked.put).toHaveBeenCalledWith("/files/f1/rename", {
      name: "x.md",
    });
    expect(res.success).toBe(true);
  });

  it("moveFile gọi PUT /files/:id/move với folder đích", async () => {
    mocked.put.mockResolvedValue({ data: { success: true } });
    await fileService.moveFile("f1", "folder-9");
    expect(mocked.put).toHaveBeenCalledWith("/files/f1/move", {
      folderId: "folder-9",
    });
  });

  it("updateFile gửi nội dung mới", async () => {
    mocked.put.mockResolvedValue({ data: { success: true } });
    await fileService.updateFile("f1", "# nội dung mới");
    expect(mocked.put).toHaveBeenCalledWith("/files/f1", {
      content: "# nội dung mới",
    });
  });

  it("deleteFile gọi DELETE /files/:id", async () => {
    mocked.delete.mockResolvedValue({ data: { success: true } });
    await fileService.deleteFile("f1");
    expect(mocked.delete).toHaveBeenCalledWith("/files/f1");
  });
});

describe("folderService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getFolders trả về [] khi gặp lỗi mạng", async () => {
    mocked.get.mockRejectedValue(new Error("network down"));
    const res = await folderService.getFolders();
    expect(res).toEqual([]);
  });

  it("renameFolder gọi PUT /folders/:id với tên mới", async () => {
    mocked.put.mockResolvedValue({ data: { success: true } });
    await folderService.renameFolder("folder-1", "Tên mới");
    expect(mocked.put).toHaveBeenCalledWith("/folders/folder-1", {
      name: "Tên mới",
    });
  });
});