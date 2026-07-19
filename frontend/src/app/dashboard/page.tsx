"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Greeting from "@/components/chat/Greeting";
import ChatInput from "@/components/chat/ChatInput";

export default function DashboardIndex() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (message: string, file?: File | null) => {
    setIsLoading(true);
    try {
      const folderId = `folder-${Date.now()}`;
      router.push(`/dashboard/folders/${folderId}`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4 md:p-8 overflow-y-auto">
      <div className="w-full max-w-4xl flex flex-col items-center gap-8 mt-[-10vh]">
        <Greeting />
        <div className="w-full">
          <ChatInput
            onSubmit={handleSubmit}
            isLoading={isLoading}
            placeholder="Ask a question, paste a YouTube link, or upload a document..."
          />
        </div>
      </div>
    </div>
  );
}
