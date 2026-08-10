"use client";

import React from "react";
import { Languages } from "lucide-react";
import { cn } from "@/utils/formatTailwind";
import { useLanguage } from "@/localization/LanguageContext";
import vn from "@/localization/languages/vn.json";
import en from "@/localization/languages/en.json";

const translation = {
    en: en,
    vn: vn
}

export const LanguageToggle: React.FC = () => {
    const {currentLanguage, setCurrentLanguage} = useLanguage();
    const currentText = translation[currentLanguage];
    const LANGUAGE_OPTIONS = [
        { id: "en", label: currentText.language.english},
        { id: "vn", label: currentText.language.vietnamese},
    ];

    return (
        <div
            className={cn(
                "flex items-center gap-2 p-1.5 bg-card border border-border rounded-lg shadow-sm"
            )}
        >
            {/* Icon & Label */}
            <div className={cn("flex items-center gap-1.5 px-2 text-muted-foreground")}>
                <Languages className={cn("w-4 h-4")} />
                <span className={cn("text-xs font-medium")}>
          {currentText.language.header}
        </span>
            </div>

            {/* Dropdown Select */}
            <select
                value={currentLanguage}
                onChange={(e) => setCurrentLanguage(e.target.value)}
                className={cn(
                    "bg-background text-foreground text-xs font-medium border border-border rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-ring cursor-pointer transition-colors"
                )}
            >
                {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
};