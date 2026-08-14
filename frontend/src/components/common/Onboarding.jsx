"use client";

import { useEffect, useState } from "react";
import { Keyboard, Search, Sparkles } from "lucide-react";
import { Modal } from "@/components/base-ui/Modal";
import { Button } from "@/components/base-ui/Button";

const TIPS = [
  {
    icon: Search,
    tint: "bg-indigo-500/10 text-indigo-400",
    title: "Tìm mọi thứ nhanh",
    desc: "Nhấn Ctrl+K để mở Command Palette — tìm tài liệu, mở sơ đồ tư duy, đổi giao diện chỉ trong vài giây.",
  },
  {
    icon: Sparkles,
    tint: "bg-purple-500/10 text-purple-400",
    title: "AI biên soạn lộ trình",
    desc: "Gõ chủ đề bạn muốn học vào khung chat — AI sẽ tự tạo lộ trình, chia bài học và lưu vào thư mục.",
  },
  {
    icon: Keyboard,
    tint: "bg-emerald-500/10 text-emerald-400",
    title: "Phím tắt hữu ích",
    desc: "Nhấn ? để xem bảng phím tắt: Ctrl+Z hoàn tác xóa, Ctrl+S lưu bài, Delete xóa mục đang chọn.",
  },
];

export default function Onboarding() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem("mf-onboarded-v1")) return;
      const t = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(t);
    } catch {
      return;
    }
  }, []);

  const finish = () => {
    try {
      localStorage.setItem("mf-onboarded-v1", "1");
    } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <Modal
      isOpen={open}
      onClose={finish}
      title="Chào mừng đến Mezon MindFolder 👋"
      size="md"
      footer={
        <div className="flex justify-end w-full">
          <Button variant="primary" onClick={finish}>
            Bắt đầu
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {TIPS.map((tip) => (
          <div
            key={tip.title}
            className="flex items-start gap-3 p-3 rounded-xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))]"
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tip.tint}`}
            >
              <tip.icon size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
                {tip.title}
              </div>
              <div className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5 leading-relaxed">
                {tip.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
