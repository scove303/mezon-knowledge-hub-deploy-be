"use client";

import React from "react";
import { useSyncExternalStore } from "react";
import { useThemeStore } from "@/store/useThemeStore";
import { getThemeOptions, ThemeMode } from "@/types/theme";
import { Sun, Moon, Palette } from "lucide-react";
import { cn } from "@/utils/formatTailwind";

import { useLanguage } from '@/localization/LanguageContext';
import vn from "@/localization/languages/vn.json";
import en from "@/localization/languages/en.json";

const translation = {
  en: en,
  vn: vn
}

const emptySubscribe = () => () => {};

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useThemeStore();
  // Guard chống lệch Hydration giữa Server và Client (client snapshot = true)
  const mounted = useSyncExternalStore(  const {currentLanguage} = useLanguage();
  const currentText = translation[currentLanguage];

    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    // Trả về khung hiển thị trống tạm thời để tránh lệch Hydration giữa Server và Client
    return <div className={cn("w-36 h-9 bg-muted rounded-md animate-pulse")} />;
  }

  return (
      <div
        className={cn(
          "flex items-center gap-2 p-1.5 bg-card border border-border rounded-lg shadow-sm",
        )}
      >
        <div
          className={cn("flex items-center gap-1.5 px-2 text-muted-foreground")}
        >
          <Palette className={cn("w-4 h-4")} />
          <span className={cn("text-xs font-medium")}>{currentText.theme.header}</span>
        </div>

        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeMode)}
          className={cn(
            "bg-background text-foreground text-xs font-medium border border-border rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-ring cursor-pointer transition-colors",
          )}
        >
          {getThemeOptions(currentText).map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
  );
};
