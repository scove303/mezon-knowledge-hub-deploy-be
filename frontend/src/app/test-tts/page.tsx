// src/app/test-tts/page.tsx

"use client";

import React, { useState } from "react";
import FileViewer from "@/features/files/components/FileViewer";
import { MOCK_FILES_DETAIL } from "@/mocks/DATA_MOCK";

export default function TestTTSPage() {
  const [currentFile, setCurrentFile] = useState(
    MOCK_FILES_DETAIL["file-py-101"],
  );

  const handleSaveContent = async (newContent: string) => {
    setCurrentFile((prev) => ({ ...prev, content: newContent }));
  };

  const handleRestoreContent = (restoredContent: string) => {
    setCurrentFile((prev) => ({ ...prev, content: restoredContent }));
  };

  return (
    <div className="w-screen h-screen bg-slate-900 flex flex-col">
      <div className="bg-slate-800 text-white px-6 py-2 text-xs flex items-center justify-between border-b border-slate-700">
        <span className="font-bold text-emerald-400">
          ● Môi trường Kiểm thử Đọc văn bản (Standalone TTS Test - Zero Backend)
        </span>
        <span>File đang mở: {currentFile.name}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <FileViewer
          file={currentFile}
          folderName={currentFile.folderName}
          folderId={currentFile.folderId}
          onSaveContent={handleSaveContent}
          onRestoreContent={handleRestoreContent}
          onAiSummary={() => alert("Đã kích hoạt tóm tắt AI")}
        />
      </div>
    </div>
  );
}
