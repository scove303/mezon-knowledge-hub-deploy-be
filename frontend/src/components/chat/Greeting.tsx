import React from "react";

import { useLanguage } from '@/localization/LanguageContext';
import vn from "@/localization/languages/vn.json";
import en from "@/localization/languages/en.json";

const translation = {
    en: en,
    vn: vn
}


export default function Greeting() {
  const {currentLanguage, setCurrentLanguage} = useLanguage();
  const currentText = translation[currentLanguage];
  return (
    <div className="flex flex-col items-center justify-center space-y-4 my-10">
      <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 text-center">
        {currentText.dashboard.chat.title}
      </h1>
      <p className="text-lg text-[rgb(var(--color-text-muted))] text-center">
        {currentText.dashboard.chat.subtitle}
      </p>
    </div>
  );
}
