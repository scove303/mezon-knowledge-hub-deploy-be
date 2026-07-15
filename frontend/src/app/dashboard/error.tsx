'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-[rgb(var(--color-bg))]">
      <h2 className="text-2xl font-bold text-red-500 mb-4">Đã xảy ra lỗi hệ thống!</h2>
      <p className="text-[rgb(var(--color-text-secondary))] mb-6 max-w-md">
        {error.message || 'Lỗi không xác định.'}
      </p>
      <div className="space-x-4">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-[rgb(var(--color-primary))] text-white rounded hover:opacity-90"
        >
          Thử lại
        </button>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-primary))] rounded hover:opacity-90"
        >
          Về trang chủ
        </button>
      </div>
    </div>
  );
}
