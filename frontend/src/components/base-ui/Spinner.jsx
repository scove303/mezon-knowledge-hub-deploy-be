export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4 border-[1.5px]',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-[3px]',
    xl: 'w-16 h-16 border-4',
  };
  return (
    <div
      className={`${sizes[size]} rounded-full border-[rgb(var(--color-surface-2))] border-t-indigo-500 animate-spin ${className}`}
    />
  );
}
