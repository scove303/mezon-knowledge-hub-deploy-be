"use client";

import Sidebar from "@/components/common/Sidebar";
import { useWorkspaceStore } from "@/features/folders/store";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSidebarOpen, toggleSidebar, setSidebarOpen } =
    useWorkspaceStore() as any;
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/dashboard" || pathname === "/") {
      setSidebarOpen(false);
    }
  }, [pathname, setSidebarOpen]);

  return (
    <div className="flex h-screen bg-[rgb(var(--color-bg))] overflow-hidden">
      {/* Sidebar - transitions its width */}
      <div
        className={`flex-shrink-0 transition-all duration-300 ease-in-out h-full ${
          isSidebarOpen
            ? "w-80 border-r border-[rgb(var(--color-border))] opacity-100"
            : "w-0 border-r-0 opacity-0 overflow-hidden"
        }`}
      >
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative transition-all duration-300">
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
