"use client";

import React, { useCallback, useRef } from "react";

interface ResizeHandleProps {
  onResize: (deltaX: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  className?: string;
}

/**
 * Thanh kéo dọc dùng chung để resize panel.
 * Kéo bằng pointer events, chỉ áp dụng delta thay đổi từ lần move trước.
 */
export default function ResizeHandle({
  onResize,
  onResizeStart,
  onResizeEnd,
  className = "",
}: ResizeHandleProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      lastX.current = e.clientX;
      e.currentTarget.setPointerCapture(e.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      onResizeStart?.();
    },
    [onResizeStart],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      if (delta !== 0) onResize(delta);
    },
    [onResize],
  );

  const stopDragging = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onDoubleClick={onResizeEnd}
      title="Double-click để đặt lại kích thước mặc định"
      className={`group absolute top-0 bottom-0 z-30 w-2 -ml-1 cursor-col-resize touch-none ${className}`}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] rounded-full bg-transparent transition-colors duration-150 group-hover:bg-[rgb(var(--color-border))] group-active:bg-indigo-500/70" />
    </div>
  );
}
