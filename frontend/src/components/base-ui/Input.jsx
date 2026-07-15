import { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  { label, error, hint, className = '', wrapperClassName = '', ...props },
  ref
) {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${wrapperClassName}`}>
      {label && (
        <label className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`w-full px-3 py-2 rounded-lg bg-[rgb(var(--color-surface-1))] border ${
          error
            ? 'border-red-500 focus:ring-red-500/30'
            : 'border-[rgb(var(--color-border))] focus:border-indigo-500 focus:ring-indigo-500/20'
        } focus:ring-2 outline-none text-sm text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] transition-all ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{hint}</p>
      )}
    </div>
  );
});
