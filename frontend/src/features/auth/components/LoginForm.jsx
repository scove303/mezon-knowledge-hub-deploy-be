"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HardDrive, MessageSquare } from "lucide-react";

import { Button } from "@/components/base-ui/Button";
import { authService } from "@/features/auth/services";
import { useAuthStore } from "@/features/auth/store";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const clearGuestId = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("mezon-guest-id");
    }
  };

  const getErrorMessage = (err) => {
    let message = "Đăng nhập thất bại. Vui lòng thử lại.";
    if (err.response?.data) {
      const d = err.response.data;
      if (d.detail?.message) {
        message = d.detail.message;
      } else if (Array.isArray(d.detail)) {
        message = d.detail.map((e) => e.msg).join("; ");
      } else if (d.message) {
        message = d.message;
      }
    }
    return message;
  };

  // Xử lý callback từ Mezon: ?code=...&state=... (hoặc ?error=...)
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (!code && !state && !error) return;

    (async () => {
      setIsLoading(true);
      setServerError("");

      if (error) {
        setServerError(
          error === "access_denied"
            ? "Bạn đã hủy đăng nhập Mezon."
            : "Đăng nhập Mezon thất bại. Vui lòng thử lại."
        );
        setIsLoading(false);
        router.replace("/login");
        return;
      }

      try {
        const res = await authService.mezonLogin(code, state);
        if (res.success) {
          clearGuestId();
          setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
          router.replace("/dashboard");
        } else {
          setServerError(res.message);
          router.replace("/login");
        }
      } catch (err) {
        console.error("[LoginForm] Lỗi đăng nhập Mezon:", err);
        setServerError(getErrorMessage(err));
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [searchParams, router, setAuth]);

  const handleMezonLogin = async () => {
    setServerError("");
    setIsLoading(true);
    try {
      const res = await authService.mezonAuthorize();
      if (res.success && res.data?.authorizeUrl) {
        window.location.href = res.data.authorizeUrl;
      } else {
        setServerError(
          "Không tạo được liên kết đăng nhập Mezon. Vui lòng thử lại."
        );
        setIsLoading(false);
      }
    } catch (err) {
      console.error("[LoginForm] Lỗi tạo liên kết Mezon:", err);
      setServerError("Không kết nối được máy chủ. Vui lòng thử lại.");
      setIsLoading(false);
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
        {serverError && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-4">
            {serverError}
          </div>
        )}

        {isLoading && (
          <p className="text-xs text-[rgb(var(--color-text-muted))] text-center mb-4">
            Đang xử lý đăng nhập...
          </p>
        )}

        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          loading={isLoading}
          onClick={handleMezonLogin}
        >
          <MessageSquare className="w-4 h-4" />
          Đăng nhập bằng Mezon
        </Button>

        <p className="text-[11px] text-[rgb(var(--color-text-muted))] text-center mt-4">
          Tài khoản của bạn sẽ được tạo tự động bằng tài khoản Mezon
        </p>
      </div>
    </>
  );
}

export default function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}
