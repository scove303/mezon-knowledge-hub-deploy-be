import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ThemeMode } from "@/types/theme";

interface ThemeState {
  theme: ThemeMode;
  setTheme: (newTheme: ThemeMode) => void;
}

// Hàm hỗ trợ áp dụng theme trực tiếp vào thẻ html của DOM
export const applyThemeToDOM = (theme: ThemeMode) => {
  if (typeof window === "undefined") return;

  const root = document.documentElement;

  // Gán thuộc tính data-theme cho khớp với bộ chọn trong global.css
  root.setAttribute("data-theme", theme);

  // Xử lý riêng class dark nếu theme là dark để tối ưu các thư viện bên thứ 3
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (newTheme: ThemeMode) => {
        applyThemeToDOM(newTheme);
        set({ theme: newTheme });
      },
    }),
    {
      name: "app-theme-storage", // Tên key lưu trong localStorage
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // Sau khi khôi phục dữ liệu từ localStorage thành công, áp dụng ngay vào DOM
        if (state?.theme) {
          applyThemeToDOM(state.theme);
        }
      },
    },
  ),
);
