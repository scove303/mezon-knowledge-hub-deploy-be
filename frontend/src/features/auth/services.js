import axiosInstance from '@/libs/axios';

export const authService = {
  async login(username, password) {
    const { data } = await axiosInstance.post('/auth/login', {
      username,
      password,
    });
    if (data.success) {
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
    }
    return data;
  },

  async refresh(refreshToken) {
    const { data } = await axiosInstance.post('/auth/refresh', {
      refreshToken,
    });
    return data;
  },

  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};
