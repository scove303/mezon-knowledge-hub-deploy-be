const variantStyles = {
  default:
    'bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))]',
  primary:
    'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  success:
    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  danger:
    'bg-red-500/10 text-red-400 border border-red-500/20',
  warning:
    'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  info:
    'bg-blue-500/10 text-blue-400 border border-blue-500/20',
};

export function Badge({ variant = 'default', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
