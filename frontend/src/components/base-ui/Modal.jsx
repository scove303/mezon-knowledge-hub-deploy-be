'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

const widths = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className={`relative w-full ${widths[size]} bg-[rgb(var(--color-surface-1))] rounded-xl border border-[rgb(var(--color-border))] shadow-2xl shadow-black/40 animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--color-border))]">
          <h3 className="font-semibold text-[rgb(var(--color-text-primary))]">
            {title}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-4 border-t border-[rgb(var(--color-border))] flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
