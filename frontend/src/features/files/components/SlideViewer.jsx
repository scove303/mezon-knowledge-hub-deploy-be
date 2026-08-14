'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronLeft, ChevronRight, X, Presentation } from 'lucide-react';
import { MarkdownComponents } from '@/components/markdown/MarkdownComponents';
import KineticGrid from '@/components/ui/kinetic-grid';
import { Button } from '@/components/base-ui/Button';

const splitSlides = (md) => {
  const lines = md.split('\n');
  const slides = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(/^##\s+(.*)$/);
    if (m) {
      if (current) slides.push(current);
      current = { title: m[1].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) slides.push(current);

  if (slides.length === 0) {
    let h1 = null;
    const body = [];
    for (const line of lines) {
      const m = line.match(/^#(?!\#)\s+(.*)$/);
      if (m) {
        if (!h1) h1 = m[1].trim();
        continue;
      }
      body.push(line);
    }
    if (h1) return [{ title: h1, body }];
  }

  return slides;
};

export default function SlideViewer({ content, name, onClose }) {
  const slides = useMemo(
    () =>
      splitSlides(content || '').length > 0
        ? splitSlides(content || '')
        : [{ title: name || 'Tài liệu', body: content || '' }],
    [content, name],
  );
  const [current, setCurrent] = useState(0);
  const touchX = useRef(null);

  // Vuốt ngang trên mobile để chuyển slide
  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) {
      setCurrent((c) => Math.min(c + 1, slides.length - 1));
    } else {
      setCurrent((c) => Math.max(c - 1, 0));
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setCurrent((c) => Math.min(c + 1, slides.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrent((c) => Math.max(c - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [slides.length, onClose]);

  const slide = slides[current];

  return (    <div className="fixed inset-0 z-[100] bg-[rgb(var(--color-bg))] flex flex-col">
      <header className="flex items-center justify-between px-5 py-3 border-b border-[rgb(var(--color-border))]">
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-secondary))] min-w-0">
          <Presentation size={16} className="text-indigo-400 shrink-0" />
          <span className="truncate">{name}</span>
          <span className="text-[rgb(var(--color-text-muted))] shrink-0">
            {current + 1} / {slides.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} title="Đóng (Esc)">
          <X size={18} />
        </Button>
      </header>

      <div
        className="flex-1 relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <KineticGrid className="absolute inset-0" />
        <div className="relative z-10 h-full overflow-y-auto scrollbar-thin flex items-center justify-center p-8">
          <div className="w-full max-w-3xl">
            <h2 className="text-3xl font-bold text-[rgb(var(--color-text-primary))] mb-8 pb-4 border-b border-[rgb(var(--color-border))]">
              {slide.title}
            </h2>
            {slide.body.length > 0 ? (
              <article className="prose prose-invert max-w-none prose-lg">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                  {slide.body.join('\n')}
                </ReactMarkdown>
              </article>
            ) : (
              <p className="text-lg text-[rgb(var(--color-text-muted))]">
                (Slide này không có nội dung)
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between px-5 py-3 border-t border-[rgb(var(--color-border))]">
        <Button
          variant="secondary"
          size="sm"
          disabled={current === 0}
          onClick={() => setCurrent((c) => Math.max(c - 1, 0))}
        >
          <ChevronLeft size={16} />
          Trước
        </Button>
        <div className="flex-1 mx-4 h-1.5 rounded-full bg-[rgb(var(--color-surface-2))] overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${((current + 1) / slides.length) * 100}%` }}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={current === slides.length - 1}
          onClick={() => setCurrent((c) => Math.min(c + 1, slides.length - 1))}
        >
          Sau
          <ChevronRight size={16} />
        </Button>
      </footer>
    </div>
  );
}