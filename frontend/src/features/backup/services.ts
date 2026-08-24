import axiosInstance from "@/libs/axios";
import { folderService } from "@/features/folders/services";
import { fileService } from "@/features/files/services";

export interface BackupFolder {
  name: string;
  type: string;
  files: { name: string; content: string }[];
}

export interface BackupData {
  app: string;
  version: 1;
  exported_at: string;
  folders: BackupFolder[];
  progress: Record<string, unknown>;
}

const PROGRESS_KEYS = [
  "mf-lessons-done",
  "mf-study-days",
  "mf-video-notes",
  "mf-current-doc",
];

function readLocalProgress(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof window === "undefined") return out;
  for (const key of PROGRESS_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) out[key] = JSON.parse(raw);
    } catch {
      // bỏ qua key hỏng
    }
  }
  return out;
}

function writeLocalProgress(progress: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  for (const key of PROGRESS_KEYS) {
    try {
      const val = progress?.[key];
      if (val != null) localStorage.setItem(key, JSON.stringify(val));
    } catch {
      // bỏ qua nếu localStorage đầy
    }
  }
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const backupService = {
  async exportData(): Promise<void> {
    const res = await folderService.getFolders();
    const folders: BackupFolder[] = (res?.data || []).map((folder: any) => ({
      name: folder.name,
      type: folder.type,
      files: (folder.files || []).map((f: any) => ({
        name: f.name,
        content: "",
      })),
    }));

    const fileIds = new Map<string, string>();
    for (const folder of res?.data || []) {
      for (const f of folder.files || []) {
        fileIds.set(f.name, f.id);
      }
    }

    // Lấy nội dung từng file (sidebar list không kèm markdown_content)
    for (const folder of folders) {
      for (const file of folder.files) {
        const id = fileIds.get(file.name);
        if (!id) continue;
        try {
          const detail = await fileService.getFile(id);
          file.content = detail?.data?.content || "";
        } catch {
          file.content = "";
        }
      }
    }

    const backup: BackupData = {
      app: "mezon-mindfolder",
      version: 1,
      exported_at: new Date().toISOString(),
      folders,
      progress: readLocalProgress(),
    };

    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(backup, `mezon-backup-${stamp}.json`);
  },

  async importData(file: File): Promise<{ folders: number; files: number }> {
    const text = await file.text();
    const backup = JSON.parse(text) as BackupData;

    if (backup.app !== "mezon-mindfolder" || !Array.isArray(backup.folders)) {
      throw new Error("File không phải bản sao lưu Mezon MindFolder hợp lệ");
    }

    let foldersImported = 0;
    let filesImported = 0;

    for (const folder of backup.folders || []) {
      const created = await folderService.createFolder(
        folder.name,
        folder.type || "general",
      );
      if (!created?.data?.id) continue;
      foldersImported++;

      for (const file of folder.files || []) {
        if (!file.content) continue;
        const fd = new FormData();
        fd.append("folder_id", created.data.id);
        fd.append(
          "file",
          new Blob([file.content], { type: "text/markdown" }),
          file.name,
        );
        await axiosInstance.post("/files", fd, {
          headers: { "Content-Type": undefined },
        });
        filesImported++;
      }
    }

    writeLocalProgress(backup.progress || {});
    return { folders: foldersImported, files: filesImported };
  },
};