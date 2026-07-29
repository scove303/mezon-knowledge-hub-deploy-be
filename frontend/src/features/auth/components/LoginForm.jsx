"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HardDrive, LogIn, Eye, EyeOff } from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";

import { Button } from "@/components/base-ui/Button";
import { Input } from "@/components/base-ui/Input";
import { Modal } from "@/components/base-ui/Modal";
import { LoginSchema } from "@/lib/validations/auth.schema";
import { authService } from "@/features/auth/services";
import { useAuthStore } from "@/features/auth/store";

export default function LoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(LoginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (values) => {
    setServerError("");
    try {
      const res = await authService.login(values.username, values.password);
      if (res.success) {
        setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
        router.push("/dashboard");
      } else {
        setServerError(res.message);
      }
    } catch (err) {
      console.error('[LoginForm] Lỗi đăng nhập:', err);
      let message = 'Đăng nhập thất bại. Vui lòng thử lại.';
      if (err.response?.data) {
        const d = err.response.data;
        if (d.detail?.message) {
          message = d.detail.message;
        } else if (Array.isArray(d.detail)) {
          message = d.detail.map((e) => e.msg).join('; ');
        } else if (d.message) {
          message = d.message;
        }
      }
      setServerError(message);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsGoogleLoading(true);
      setServerError('');
      try {
        // Dùng access_token từ Google lấy thông tin user hoặc gửi thẳng về backend
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await userInfoRes.json();
        
        // Gửi email/name của tài khoản Google vừa chọn về API backend
        const res = await authService.googleLogin(userInfo.email);
        if (res.success) {
          setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
          router.push('/dashboard');
        } else {
          setServerError(res.message);
        }
      } catch (err) {
        setServerError('Đăng nhập Google thất bại. Vui lòng thử lại.');
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: () => {
      setServerError('Đăng nhập Google bị hủy hoặc thất bại.');
    },
  });

  const handleGoogleMockLogin = () => {
    googleLogin();
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
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <Input
            id="username"
            label="Tên đăng nhập"
            placeholder="Nhập tên đăng nhập..."
            autoComplete="username"
            error={errors.username?.message}
            {...register("username")}
          />

          <div className="relative">
            <Input
              id="password"
              label="Mật khẩu"
              type={showPassword ? "text" : "password"}
              placeholder="Nhập mật khẩu..."
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
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

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-[rgb(var(--color-border))]"></div>
            <span className="flex-shrink mx-4 text-xs text-[rgb(var(--color-text-muted))]">
              Hoặc
            </span>
            <div className="flex-grow border-t border-[rgb(var(--color-border))]"></div>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full flex items-center justify-center gap-2"
            onClick={handleGoogleMockLogin}
            loading={isGoogleLoading}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Đăng nhập với Google
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-[rgb(var(--color-text-muted))] mt-6">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          Đăng ký
        </Link>
      </p>
    </>
  );
}
