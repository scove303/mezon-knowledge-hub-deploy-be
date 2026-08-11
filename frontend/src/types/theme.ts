import { useLanguage } from '@/localization/LanguageContext';
import vn from "@/localization/languages/vn.json";
import en from "@/localization/languages/en.json";
import {useState} from "react";

const translation = {
  en: en,
  vn: vn
}


const currentLanguage = "vn"; //UNFINISHED
const currentText = translation[currentLanguage];

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

export const getThemeOptions = (currentText: any): ThemeOption[] => [
  { id: "light", label: currentText.theme.light, colorPreview: "#2563eb" },
  { id: "dark", label: currentText.theme.dark, colorPreview: "#3b82f6" },
  { id: "cisher", label: currentText.theme.cisher, colorPreview: "#5c6bc0" },
  { id: "sunset-gradient", label: currentText.theme.sunsetGradient, colorPreview: "#ec4899" },
  { id: "crimson-dark", label: currentText.theme.crimsonDark, colorPreview: "#e11d48" },
];
