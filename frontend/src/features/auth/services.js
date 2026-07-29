import axiosInstance from '@/libs/axios';

export const authService = {
  async login(username, password) {
    const { data } = await axiosInstance.post('/auth/login', {
      username,
      password,
    });
    return data;
  },

  async googleLogin(idToken) {
    const { data } = await axiosInstance.post('/auth/google', {
      id_token: idToken,
    });
    return data;
  },

  async refresh(refreshToken) {
    const { data } = await axiosInstance.post('/auth/refresh', {
      refreshToken,
    });
    return data;
  },

  async register(username, password, email, display_name) {
    const { data } = await axiosInstance.post('/auth/register', {
      username,
      password,
      email,
      display_name,
    });
    return data;
  },

  logout() {
    // State clearing is handled by the store
  },
};
