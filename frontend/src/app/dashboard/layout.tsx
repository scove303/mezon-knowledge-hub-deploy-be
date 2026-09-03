"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store";
import Sidebar from "@/components/common/Sidebar";
import ResizeHandle from "@/components/common/ResizeHandle";
import CommandPalette from "@/components/common/CommandPalette";
import ShortcutHelp from "@/components/common/ShortcutHelp";
import Onboarding from "@/components/common/Onboarding";
import { useWorkspaceStore, SIDEBAR_WIDTH_DEFAULT } from "@/features/folders/store";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { PanelLeft, PanelLeftClose, WifiOff } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    isSidebarOpen,
    toggleSidebar,
    setSidebarOpen,
    sidebarWidth,
    setSidebarWidth,
  } = useWorkspaceStore() as any;
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-[rgb(var(--color-bg))] overflow-hidden">
      {!isOnline && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-amber-500/95 text-amber-950 text-xs font-medium text-center py-1.5 px-4 shadow-lg animate-fade-in flex items-center justify-center gap-1.5">
          <WifiOff size={13} className="shrink-0" />
          <span>Mất kết nối — dữ liệu đang hiển thị từ bộ nhớ đã tải. Thao tác sẽ được đồng bộ khi có mạng lại.</span>
        </div>
      )}
      {/* Sidebar - resizable width */}
      <div
        className={`relative flex-shrink-0 h-full overflow-hidden ${
          isSidebarOpen
            ? "opacity-100 border-r border-[rgb(var(--color-border))]"
            : "w-0 border-r-0 opacity-0"
        }`}
        style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
      >
        <Sidebar />

        {isSidebarOpen && (
          <ResizeHandle
            onResize={(delta) => setSidebarWidth(sidebarWidth + delta)}
            onResizeStart={() => setSidebarOpen(true)}
            onResizeEnd={() => setSidebarWidth(SIDEBAR_WIDTH_DEFAULT)}
            className="right-0 -mr-1"
          />
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <CommandPalette />
        <ShortcutHelp />
        <Onboarding />
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <button
            onClick={toggleSidebar}
            className="p-2 bg-[rgb(var(--color-surface-1))] hover:bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] rounded-lg transition-colors shadow-sm min-w-[44px] min-h-[44px] flex items-center justify-center md:min-w-0 md:min-h-0"
            title="Toggle Sidebar"
            aria-label="Đóng mở thanh thư mục"
          >
            {isSidebarOpen ? (
              <PanelLeftClose size={20} />
            ) : (
              <PanelLeft size={20} />
            )}
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
