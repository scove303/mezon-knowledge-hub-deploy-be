"use client";

import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { Modal } from "@/components/base-ui/Modal";
import { Button } from "@/components/base-ui/Button";

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], desc: "Mở Command Palette (tìm file, tạo thư mục, đổi theme)" },
  { keys: ["?"], desc: "Bảng phím tắt này" },
  { keys: ["Ctrl", "Z"], desc: "Hoàn tác thao tác xóa" },
  { keys: ["Delete"], desc: "Xóa mục đang chọn (Sidebar)" },
  { keys: ["Ctrl", "S"], desc: "Lưu nội dung khi đang chỉnh sửa" },
  { keys: ["Esc"], desc: "Đóng cửa sổ / trình chiếu / menu" },
  { keys: ["→", "←"], desc: "Chuyển slide (chế độ trình chiếu)" },
  { keys: ["Space"], desc: "Slide tiếp theo (chế độ trình chiếu)" },
  { keys: ["@", "s", "u", "b"], desc: "Yêu cầu AI tạo thư mục con (gõ @subfolder trong chat)" },
  { keys: ["/", "s", "u", "b"], desc: "Yêu cầu AI tạo thư mục con (gõ /subfolder trong chat)" },
];

const isInputting = () =>
  ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) ||
  document.activeElement?.isContentEditable;

export default function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "?") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isInputting()) return;
      e.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {open && (
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Phím Tắt"
          size="sm"
        >
          <div className="flex flex-col divide-y divide-[rgb(var(--color-border))]">
            {SHORTCUTS.map((s) => (
              <div
                key={`${s.keys.join("+")}-${s.desc}`}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <span className="text-xs text-[rgb(var(--color-text-secondary))]">
                  {s.desc}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {s.keys.map((k) => (
                    <kbd
                      key={k}
                      className="px-1.5 py-0.5 rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-1))] text-[10px] font-mono font-semibold text-[rgb(var(--color-text-primary))]"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 p-2 rounded-lg bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-indigo-400 hover:border-indigo-500/40 transition-colors shadow-sm"
        title="Phím tắt (?)"
        aria-label="Phím tắt (?)"
      >
        <Keyboard className="w-4 h-4" />
      </button>
    </>
  );
}