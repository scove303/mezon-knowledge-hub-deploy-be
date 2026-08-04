import axios from "axios";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

const getTokens = () => {
  if (typeof window === "undefined")
    return { accessToken: null, refreshToken: null };
  try {
    const authData = localStorage.getItem("mezon-auth");
    if (authData) {
      const parsed = JSON.parse(authData);
      return {
        accessToken: parsed.state?.accessToken || null,
        refreshToken: parsed.state?.refreshToken || null,
      };
    }
  } catch (e) {
    console.error("Lỗi phân tích cú pháp mezon-auth:", e);
  }
  return { accessToken: null, refreshToken: null };
};

const getGuestId = () => {
  if (typeof window === "undefined") return null;
  try {
    let guestId = localStorage.getItem("mezon-guest-id");
    if (!guestId) {
      guestId =
        (crypto.randomUUID && crypto.randomUUID()) ||
        `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("mezon-guest-id", guestId);
    }
    return guestId;
  } catch (e) {
    console.error("Lỗi đọc guest id:", e);
    return null;
  }
};

// ─── Request Interceptor ─────────────────────────────────────────────────────
axiosInstance.interceptors.request.use(
  (config) => {
    const { accessToken } = getTokens();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    } else {
      // Chưa đăng nhập → định danh bằng Guest ID để backend merge dữ liệu sau khi login
      const guestId = getGuestId();
      if (guestId) {
        config.headers["X-Guest-Id"] = guestId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
let isRefreshing = false;
let pendingQueue = [];

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

      // Nếu đã có refreshToken, tiến hành các bước làm mới bên dưới:
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

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Không cần check 'if (!refreshToken)' ở đây nữa vì đã check sớm ở phía trên
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        if (typeof window !== "undefined") {
          const authData = localStorage.getItem("mezon-auth");
          if (authData) {
            const parsed = JSON.parse(authData);
            parsed.state.accessToken = newAccessToken;
            parsed.state.refreshToken = newRefreshToken;
            localStorage.setItem("mezon-auth", JSON.stringify(parsed));
          }
        }

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Không tự động chuyển hướng (redirect) về login nữa để cho phép chế độ Guest hoạt động
        if (typeof window !== "undefined") {
          localStorage.removeItem("mezon-auth");
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
