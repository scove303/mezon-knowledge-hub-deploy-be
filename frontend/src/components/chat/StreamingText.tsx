"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { normalizeLatex } from "@/utils/formatLatex";

interface StreamingTextProps {
  text: string;
  active?: boolean;
  speed?: number;
  className?: string;
}

export default function StreamingText({
  text,
  active = false,
  speed = 14,
  className,
}: StreamingTextProps) {
  const [count, setCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Khi không còn typing → hiện toàn bộ; khi đang typing → hiện số ký tự đã "gõ"
  const shownCount = active ? Math.min(count, text.length) : text.length;
  const shown = text.slice(0, shownCount);
  const isTyping = active && shownCount < text.length;

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev >= text.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 2;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [active, text, speed]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  }, [shown]);

  if (!active) {
    return (
      <div ref={containerRef} className={className}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeKatex, { strict: "ignore", throwOnError: false }]]}
        >
          {normalizeLatex(text)}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <span className="whitespace-pre-wrap">{shown}</span>
      {isTyping && (
        <span className="inline-block w-[2px] h-[1em] bg-indigo-400 align-middle ml-0.5 animate-pulse" />
      )}
    </div>
  );
}
