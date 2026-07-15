'use client';

import LoginForm from '@/features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg))] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-8 relative z-10">
        <LoginForm />
        <p className="text-center text-[10px] text-[rgb(var(--color-text-disabled))]">
          Mezon Knowledge Hub © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
