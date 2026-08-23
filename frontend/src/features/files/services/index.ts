// src/features/files/services/index.ts

import { mockFileService } from "@/mocks/mockServices";

// Khi test offline không Backend, bật biến môi trường hoặc gán trực tiếp true
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true" || true;

export const fileService = USE_MOCK
  ? mockFileService
  : {
      // Lớp API thực kết nối Backend HTTP khi có server
      async listRevisions(fileId: string) {
        const res = await fetch(`/api/v1/files/${fileId}/revisions`);
        return res.json();
      },
      async restoreRevision(fileId: string, revisionId: string) {
        const res = await fetch(`/api/v1/files/${fileId}/restore`, {
          method: "POST",
          body: JSON.stringify({ revisionId }),
        });
        return res.json();
      },
      async deleteFile(fileId: string) {
        const res = await fetch(`/api/v1/files/${fileId}`, {
          method: "DELETE",
        });
        return res.json();
      },
    };
