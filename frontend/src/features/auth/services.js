import axiosInstance from '@/libs/axios';

export const authService = {
  async mezonAuthorize() {
    const { data } = await axiosInstance.get('/auth/mezon/authorize');
    return data;
  },

  async mezonLogin(code, state) {
    const { data } = await axiosInstance.post('/auth/mezon', {
      code,
      state,
    });
    return data;
  },

  async refresh(refreshToken) {
    const { data } = await axiosInstance.post('/auth/refresh', {
      refreshToken,
    });
    return data;
  },

  logout() {
    // State clearing is handled by the store
  },
};
