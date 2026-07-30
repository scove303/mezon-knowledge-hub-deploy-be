import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/global.css";
import React from "react";
import Providers from "@/components/layout/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Đổi theme
// Mã JavaScript đồng bộ chạy trước khi DOM kịp vẽ lên màn hình
const themeInitializerScript = `
  (function() {
    try {
      var storageKey = 'app-theme-storage';
      var savedData = localStorage.getItem(storageKey);
      var theme = 'light';
      if (savedData) {
        var parsed = JSON.parse(savedData);
        if (parsed && parsed.state && parsed.state.theme) {
          theme = parsed.state.theme;
        }
      }
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    } catch (err) {
      console.error('Can't read Theme in localStorage:', err);
    }
  })();
`;

export const metadata = {
  title: "Mezon MindFolder | Knowledge Hub",
  description:
    "Trợ lý AI biên soạn, phân loại và quản lý tri thức đa phương tiện trên Mezon.",
  keywords: ["knowledge hub", "mezon", "ai", "learning", "documents"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        {/* Nhúng đoạn script chống nhấp nháy giao diện */}
        <script
          dangerouslySetInnerHTML={{ __html: themeInitializerScript }}
        ></script>
      </head>

      <body className="h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
