import { Spinner } from '@/components/base-ui/Spinner';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--color-bg))]">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-[rgb(var(--color-text-muted))] font-medium tracking-wide animate-pulse">
          Đang tải...
        </p>
      </div>
    </div>
  );
}
