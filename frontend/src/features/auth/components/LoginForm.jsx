"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HardDrive, MessageSquare } from "lucide-react";

import { Button } from "@/components/base-ui/Button";
import { authService } from "@/features/auth/services";
import { useAuthStore } from "@/features/auth/store";
import { useLanguage } from "@/localization/LanguageContext";
import vn from "@/localization/languages/vn.json";
import en from "@/localization/languages/en.json";

const translation = {
  en: en,
  vn: vn,
};

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { currentLanguage } = useLanguage();
  const currentText = translation[currentLanguage];

  const clearGuestId = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("mezon-guest-id");
    }
  };

  const getErrorMessage = useCallback(
    (err) => {
      let message = currentText.login.failed;
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
    },
    [currentText.login.failed]
  );

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
            ? currentText.login.access_denied
            : currentText.login.failed
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
  }, [
    searchParams,
    router,
    setAuth,
    currentText.login.access_denied,
    currentText.login.failed,
    getErrorMessage,
  ]);

  const handleMezonLogin = async () => {
    setServerError("");
    setIsLoading(true);
    try {
      const res = await authService.mezonAuthorize();
      if (res.success && res.data?.authorizeUrl) {
        window.location.href = res.data.authorizeUrl;
      } else {
        setServerError(currentText.login.link_error);
        setIsLoading(false);
      }
    } catch (err) {
      console.error("[LoginForm] Lỗi tạo liên kết Mezon:", err);
      setServerError(currentText.login.server_error);
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
            {currentText.login.header}
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
            {currentText.login.processing}
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
          {currentText.login.mezon}
        </Button>

        <p className="text-[11px] text-[rgb(var(--color-text-muted))] text-center mt-4">
          {currentText.login.mezon_note}
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
