"use client";

import { useEffect } from "react";

// Đăng ký Service Worker cho PWA. Chỉ chạy ở production
// để tránh xung đột với HMR/Next dev server.
export default function PwaRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Đăng ký Service Worker thất bại:", err);
    });
  }, []);

  return null;
}