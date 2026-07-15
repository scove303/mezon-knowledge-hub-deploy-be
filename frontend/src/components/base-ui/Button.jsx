import React from 'react';
import { Loader2 } from 'lucide-react';

const variantStyles = {
  primary:
    'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20',
  secondary:
    'bg-[rgb(var(--color-surface-2))] hover:bg-[rgb(var(--color-surface-3))] text-[rgb(var(--color-text-secondary))] border border-[rgb(var(--color-border))]',
  danger:
    'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-sm shadow-red-500/20',
  success:
    'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20',
  ghost:
    'hover:bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]',
  outline:
    'border border-[rgb(var(--color-border))] hover:border-indigo-500 text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]',
};

const sizeStyles = {
  xs: 'px-2 py-1 text-[10px] gap-1 rounded-md',
  sm: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-3.5 py-2 text-sm gap-2 rounded-lg',
  lg: 'px-5 py-2.5 text-base gap-2.5 rounded-xl',
  icon: 'p-2 rounded-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-all duration-[var(--transition-fast)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}
