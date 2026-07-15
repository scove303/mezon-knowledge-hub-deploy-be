'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { HardDrive, LogIn, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/base-ui/Button';
import { Input } from '@/components/base-ui/Input';
import { LoginSchema } from '@/lib/validations/auth.schema';
import { authService } from '@/features/auth/services';
import { useAuthStore } from '@/features/auth/store';

export default function LoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(LoginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const res = await authService.login(values.username, values.password);
      if (res.success) {
        setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
        router.push('/dashboard/folders/default');
      } else {
        setServerError(res.message);
      }
    } catch (err) {
      setServerError(
        err.response?.data?.message ||
          err.response?.data?.detail?.message ||
          'Đăng nhập thất bại. Vui lòng thử lại.'
      );
    }
  };

  return (
    <>
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/25">
          <HardDrive className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
            Mezon MindFolder
          </h1>
          <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">
            Đăng nhập vào không gian tri thức của bạn
          </p>
        </div>
      </div>

      <div className="bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] rounded-2xl p-6 shadow-xl shadow-black/20 mt-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            id="username"
            label="Tên đăng nhập"
            placeholder="Nhập tên đăng nhập..."
            autoComplete="username"
            error={errors.username?.message}
            {...register('username')}
          />

          <div className="relative">
            <Input
              id="password"
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              placeholder="Nhập mật khẩu..."
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-[34px] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] transition-colors p-1"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          {serverError && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              {serverError}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            loading={isSubmitting}
          >
            <LogIn className="w-4 h-4" />
            Đăng nhập
          </Button>
        </form>
      </div>
    </>
  );
}
