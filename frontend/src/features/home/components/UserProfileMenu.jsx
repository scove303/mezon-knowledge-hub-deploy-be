import React, { useEffect, useRef, useState } from "react";
import {
  Folder,
  FileText,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Compass,
  FileCheck,
  Video,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/base-ui/Button";
import { Input } from "@/components/base-ui/Input";
import { Modal } from "@/components/base-ui/Modal";
import { authService } from "@/features/auth/services";
import { useAuthStore } from "@/features/auth/store";
import { useWorkspaceStore } from "@/features/folders/store";
import { folderService } from "@/features/folders/services";

export default function UserProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  // Tạo 1 reference gắn vào thẻ div bao ngoài toàn bộ Menu. Dùng để xác định điểm va chạm khi người dùng click chuột.
  const menuRef = useRef(null);

  const user = useAuthStore((state) => state.user) || {
    name: "Tester",
    email: "tester@mezon.io",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  };

  // Lắng nghe sự kiện click toàn trang. Nếu vị trí click KHÔNG nằm trong menuRef.current (click ra ngoài Menu), lập tức set setIsOpen(false). Đây là kỹ thuật giải quyết dứt điểm lỗi UI bị kẹt Menu Popover.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      // DO
      await authService.logout();
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <div className="relative w-full" ref={menuRef}>
      {/* Profile Menu Xuất hiện phía TRÊN Avatar khi mở */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 w-full bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] rounded-2xl shadow-2xl py-2 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150 z-50">
          {/* Header Thông tin User */}
          <div className="px-3 py-2 border-b border-[rgb(var(--color-border))]">
            <p className="text-xs font-bold text-[rgb(var(--color-text-primary))] truncate">
              {user.name}
            </p>
            <p className="text-[11px] text-[rgb(var(--color-text-muted))] truncate">
              {user.email}
            </p>
          </div>

          {/* Các chức năng Mở rộng sau này */}
          {/* <div>
            <button>
              <span>Setting</span>
            </button>
          </div> */}

          <div className="border-t border-[rgb(var(--color-border))] pt-1 px-1">
            {/* Nút Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-2.5 px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
