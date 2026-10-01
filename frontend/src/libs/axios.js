import axios from "axios";
import { useAuthStore } from "@/features/auth/store";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://backend-production-a6b3.up.railway.app/api/v1";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  timeout: 60000,
});

const normalizeToken = (token) => {
  if (Array.isArray(token)) {
    return typeof token[0] === "string" ? token[0] : null;
  }
  return typeof token === "string" ? token : null;
};

const getTokens = () => {
  if (typeof window === "undefined")
    return { accessToken: null, refreshToken: null };
  try {
    const store = useAuthStore.getState();
    if (store?.accessToken || store?.refreshToken) {
      return {
        accessToken: normalizeToken(store.accessToken),
        refreshToken: normalizeToken(store.refreshToken),
      };
    }
    const authData = localStorage.getItem("mezon-auth");
    if (authData) {
      const parsed = JSON.parse(authData);
      return {
        accessToken: normalizeToken(parsed.state?.accessToken),
        refreshToken: normalizeToken(parsed.state?.refreshToken),
      };
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Lỗi lấy token xác thực");
    }
  }
  return { accessToken: null, refreshToken: null };
};

// Kiểm tra xem URL có phải là cùng origin / API base của ứng dụng không
const isSameOriginOrApi = (url) => {
  if (!url) return true;

  // Check for protocol-relative URLs (//evil.com) - these are NOT same origin
  if (url.startsWith("//")) return false;

  // Relative paths (/, ./, ../) are safe - they resolve to current origin
  if (url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) return true;

  try {
    const targetUrl = new URL(url, BASE_URL);
    const apiUrl = new URL(BASE_URL);
    return targetUrl.origin === apiUrl.origin;
  } catch {
    return false;
  }
};

// ─── Request Interceptor ─────────────────────────────────────────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    // Chỉ đính kèm Authorization cho requests gửi tới API của ứng dụng
    if (isSameOriginOrApi(config.url)) {
      const { accessToken } = getTokens();
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
// BroadcastChannel để đồng bộ refresh state giữa các tab
let refreshChannel = null;
if (typeof window !== "undefined" && window.BroadcastChannel) {
  refreshChannel = new BroadcastChannel("mezon-auth-refresh");
}

let isRefreshing = false;
let pendingQueue = [];

// Xử lý message từ tab khác
if (refreshChannel) {
  refreshChannel.onmessage = (event) => {
    const { type, token } = event.data;
    if (type === "REFRESH_SUCCESS" && token) {
      // Tab khác đã refresh thành công, dùng token đó
      processQueue(null, token);
    } else if (type === "REFRESH_FAILED") {
      // Tab khác refresh thất bại, reject queue
      processQueue(new Error("Refresh failed in another tab"), null);
    }
  };
}

// Fallback: Listen for localStorage changes (storage event fires in other tabs)
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === "mezon-auth" && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        const newAccessToken = parsed.state?.accessToken;
        if (newAccessToken && isRefreshing) {
          // Another tab updated the token, use it
          processQueue(null, newAccessToken);
        }
      } catch {
        // Ignore parse errors
      }
    }
  });
}

const processQueue = (error, token = null) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Chỉ thực hiện tự động làm mới token nếu gặp lỗi 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 1. Lấy refreshToken ngay khi bắt đầu gặp lỗi 401
      const { refreshToken } = getTokens();

      // 2. NẾU LÀ GUEST (Không có refresh token):
      // Trả thẳng lỗi 401 gốc về cho component tự xử lý (ví dụ: dùng data Mock),
      // tránh gọi cơ chế refresh và không quăng ra Error tùy ý làm sập giao diện.
      if (!refreshToken) {
        return Promise.reject(error);
      }

      // Đánh dấu _retry ngay từ đầu để tránh lặp vô hạn nếu request trong queue thất bại
      originalRequest._retry = true;

      // Nếu đang trong tiến trình refresh, đẩy request vào hàng đợi
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch(Promise.reject.bind(Promise));
      }

      isRefreshing = true;

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        // Cập nhật Zustand store (đồng thời zustand persist sẽ tự sync vào localStorage)
        useAuthStore.getState().updateTokens(newAccessToken, newRefreshToken);

        // Broadcast success to other tabs
        if (refreshChannel) {
          refreshChannel.postMessage({ type: "REFRESH_SUCCESS", token: newAccessToken });
        }

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Broadcast failure to other tabs
        if (refreshChannel) {
          refreshChannel.postMessage({ type: "REFRESH_FAILED" });
        }
        processQueue(refreshError, null);
        // Clear auth qua Zustand store
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
export { getTokens };
