export type ThemeMode =
  | "light"
  | "dark"
  | "cisher"
  | "sunset-gradient"
  | "crimson-dark";

export interface ThemeOption {
  id: ThemeMode;
  label: string;
  colorPreview: string; // Mã màu đại diện để hiển thị trên menu chọn
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: "light", label: "Chủ đề Sáng", colorPreview: "#2563eb" },
  { id: "dark", label: "Chủ đề Tối", colorPreview: "#3b82f6" },
  { id: "cisher", label: "Chủ đề Cisher", colorPreview: "#5c6bc0" },
  { id: "sunset-gradient", label: "Chủ đề Sương tím", colorPreview: "#ec4899" },
  { id: "crimson-dark", label: "Chủ đề Đỏ tối", colorPreview: "#e11d48" },
];
