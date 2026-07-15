'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/base-ui/Button';

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log to an error monitoring service (e.g., Sentry)
    console.error('[Error Boundary]:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--color-bg))] p-8">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
            Có lỗi xảy ra!
          </h2>
          <p className="text-sm text-[rgb(var(--color-text-muted))] leading-relaxed">
            {error?.message || 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại hoặc quay về trang chủ.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} variant="primary">
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </Button>
          <Button onClick={() => (window.location.href = '/dashboard')} variant="secondary">
            <Home className="w-4 h-4" />
            Về Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
