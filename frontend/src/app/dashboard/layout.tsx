"use client";

import Sidebar from "@/components/common/Sidebar";
import ResizeHandle from "@/components/common/ResizeHandle";
import CommandPalette from "@/components/common/CommandPalette";
import ShortcutHelp from "@/components/common/ShortcutHelp";
import { useWorkspaceStore, SIDEBAR_WIDTH_DEFAULT } from "@/features/folders/store";
import { PanelLeft, PanelLeftClose } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    isSidebarOpen,
    toggleSidebar,
    setSidebarOpen,
    sidebarWidth,
    setSidebarWidth,
  } = useWorkspaceStore() as any;

  return (
    <div className="flex h-screen bg-[rgb(var(--color-bg))] overflow-hidden">
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
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <button
            onClick={toggleSidebar}
            className="p-2 bg-[rgb(var(--color-surface-1))] hover:bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] rounded-lg transition-colors shadow-sm"
            title="Toggle Sidebar"
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
