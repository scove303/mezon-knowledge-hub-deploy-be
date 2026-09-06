"use client";

import React from "react";
import ReactMarkdown, { Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { normalizeLatex } from "@/utils/formatLatex";

interface MarkdownRendererProps {
  content: string;
  components?: Options["components"];
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  components,
  className = "",
}) => {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: "ignore", throwOnError: false }]]}
        components={components}
      >
        {normalizeLatex(content)}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
