import React, { useEffect, useRef, useState } from "react";
import { LogOut, ChevronUp, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { authService } from "@/features/auth/services";
import { useAuthStore } from "@/features/auth/store";
import { cn } from "@/utils/formatTailwind";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageToggle } from "@/components/language/LanguageToggle";

export default function UserProfileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const user = useAuthStore((state) => state.user) || {};

  // Backend trả về display_name / avatar_url (snake_case).
  // Fallback cho tài khoản cũ lưu theo camelCase (name / avatarUrl).
  const displayName = isAuthenticated
    ? user.display_name || user.name || "Tester"
    : "Khách";
  const email = isAuthenticated
    ? user.email || "tester@mezon.io"
    : "Dữ liệu tạm sẽ được chuyển sang tài khoản khi bạn đăng nhập";
  const avatarUrl = isAuthenticated
    ? user.avatar_url ||
      user.avatarUrl ||
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex"
    : "https://api.dicebear.com/7.x/avataaars/svg?seed=guest";

  // Click outside listener
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
      await authService.logout();
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      clearAuth();
      router.push("/login");
    }
  };

  return (
    <div className={cn("relative w-full")} ref={menuRef}>
      {/* 1. NÚT TRIGGER (Hiển thị Avatar & Tên trong Sidebar) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full flex items-center justify-between p-2 rounded-xl hover:bg-[rgb(var(--color-surface-2))] transition-colors group cursor-pointer border border-transparent hover:border-[rgb(var(--color-border))]",
        )}
      >
        <div className={cn("flex items-center space-x-3 min-w-0")}>
          <img
            src={avatarUrl}
            alt={displayName}
            className={cn(
              "w-8 h-8 rounded-lg bg-indigo-500/20 flex-shrink-0 object-cover",
            )}
          />
          <div className={cn("text-left min-w-0")}>
            <p
              className={cn(
                "text-xs font-semibold text-[rgb(var(--color-text-primary))] truncate",
              )}
            >
              {displayName}
            </p>
            <p
              className={cn(
                "text-[10px] text-[rgb(var(--color-text-muted))] truncate",
              )}
            >
              {email}
            </p>
          </div>
        </div>
        <ChevronUp
          className={cn(
            "w-4 h-4 text-[rgb(var(--color-text-muted))] transition-transform duration-200 flex-shrink-0",
            isOpen ? "rotate-0" : "rotate-180",
          )}
        />
      </button>

      {/* 2. POPOVER MENU (Xuất hiện phía TRÊN Nút Trigger khi click) */}
      {isOpen && (
        <div
          className={cn(
            "absolute bottom-full left-0 right-0 mb-2 w-full bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] rounded-2xl shadow-2xl py-2 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150 z-50",
          )}
        >
          {/* Header Thông tin User */}
          <div
            className={cn(
              "px-3 py-2 border-b border-[rgb(var(--color-border))]",
            )}
          >
            <p
              className={cn(
                "text-xs font-bold text-[rgb(var(--color-text-primary))] truncate",
              )}
            >
              {displayName}
            </p>
            <p
              className={cn(
                "text-[11px] text-[rgb(var(--color-text-muted))] truncate",
              )}
            >
              {email}
            </p>
          </div>

          <div className={cn("pt-1 px-1")}>
            <LanguageToggle />
          </div>

          <div className={cn("pt-1 px-1")}>
            <ThemeToggle />
          </div>

          {/* Nút Logout / Đăng nhập */}
          <div className="pt-1 px-1">
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className={cn(
                  "w-full flex items-center space-x-2.5 px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors",
                )}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className={cn("font-medium")}>Đăng xuất</span>
              </button>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className={cn(
                  "w-full flex items-center space-x-2.5 px-2.5 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors",
                )}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className={cn("font-medium")}>
                  Đăng nhập để lưu dữ liệu
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
