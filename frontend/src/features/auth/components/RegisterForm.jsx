"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HardDrive, UserPlus, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/base-ui/Button";
import { Input } from "@/components/base-ui/Input";
import { RegisterSchema } from "@/lib/validations/auth.schema";
import { authService } from "@/features/auth/services";
import { useAuthStore } from "@/features/auth/store";

export default function RegisterForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { username: "", email: "", display_name: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values) => {
    setServerError("");
    try {
      const res = await authService.register(
        values.username,
        values.password,
        values.email || undefined,
        values.display_name || undefined,
      );
      if (res.success) {
        setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
        router.push("/dashboard");
      } else {
        setServerError(res.message);
      }
    } catch (err) {
      console.error('[RegisterForm] Lỗi đăng ký:', err);

      let message = 'Đăng ký thất bại. Vui lòng thử lại.';
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

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/25">
          <HardDrive className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
            Mezon MindFolder
          </h1>
          <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">
            Tạo tài khoản mới
          </p>
        </div>
      </div>

      <div className="bg-[rgb(var(--color-surface-1))] border border-[rgb(var(--color-border))] rounded-2xl p-6 shadow-xl shadow-black/20">
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

          <Input
            id="email"
            label="Email (không bắt buộc)"
            type="email"
            placeholder="Nhập email..."
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />

          <Input
            id="display_name"
            label="Tên hiển thị (không bắt buộc)"
            placeholder="Nhập tên hiển thị..."
            error={errors.display_name?.message}
            {...register("display_name")}
          />

          <div className="relative">
            <Input
              id="password"
              label="Mật khẩu"
              type={showPassword ? "text" : "password"}
              placeholder="Nhập mật khẩu..."
              autoComplete="new-password"
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

          <div className="relative">
            <Input
              id="confirmPassword"
              label="Xác nhận mật khẩu"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Nhập lại mật khẩu..."
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((p) => !p)}
              className="absolute right-3 top-[34px] text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] transition-colors p-1"
            >
              {showConfirmPassword ? (
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
            <UserPlus className="w-4 h-4" />
            Đăng ký
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-[rgb(var(--color-text-muted))]">
        Đã có tài khoản?{" "}
        <Link
          href="/login"
          className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          Đăng nhập
        </Link>
      </p>

      <p className="text-center text-[10px] text-[rgb(var(--color-text-disabled))]">
        Mezon Knowledge Hub © {new Date().getFullYear()}
      </p>
    </div>
  );
}
