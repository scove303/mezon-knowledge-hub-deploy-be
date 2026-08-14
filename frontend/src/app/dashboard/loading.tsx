// Skeleton hiển thị khi điều hướng giữa các trang dashboard
// (App Router streaming: thay thế nội dung cũ ngay lập tức, không chờ data)

export default function DashboardLoading() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-[rgb(var(--color-bg))] animate-pulse">
      {/* Left: Chat panel skeleton */}
      <div className="flex flex-col flex-1 min-w-0 h-full p-4">
        <div className="h-6 w-48 rounded-lg bg-[rgb(var(--color-surface-2))] mb-4" />
        <div className="flex-1 space-y-3">
          <div className="flex justify-end">
            <div className="h-12 w-2/3 rounded-2xl rounded-tr-sm bg-[rgb(var(--color-surface-2))]" />
          </div>
          <div className="h-24 w-3/4 rounded-xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))]" />
          <div className="h-10 w-1/2 rounded-xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))]" />
        </div>
        <div className="h-12 rounded-2xl bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] mt-4" />
      </div>

      {/* Right: Document panel skeleton */}
      <div className="hidden md:flex flex-col w-1/2 min-w-[300px] h-full bg-[rgb(var(--color-surface-1))] border-l border-[rgb(var(--color-border))] p-4">
        <div className="flex gap-2 mb-4">
          <div className="h-8 w-20 rounded-lg bg-[rgb(var(--color-surface-2))]" />
          <div className="h-8 w-24 rounded-lg bg-[rgb(var(--color-surface-2))]" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-full rounded bg-[rgb(var(--color-surface-2))]" />
          <div className="h-4 w-11/12 rounded bg-[rgb(var(--color-surface-2))]" />
          <div className="h-4 w-4/5 rounded bg-[rgb(var(--color-surface-2))]" />
          <div className="h-4 w-full rounded bg-[rgb(var(--color-surface-2))] mt-6" />
          <div className="h-4 w-3/4 rounded bg-[rgb(var(--color-surface-2))]" />
          <div className="h-4 w-5/6 rounded bg-[rgb(var(--color-surface-2))]" />
        </div>
      </div>
    </div>
  );
}