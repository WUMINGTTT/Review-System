import { defineStore } from 'pinia';
import { ref } from 'vue';
import { loginApi, getMeApi } from '@/api/auth';

interface UserInfo {
  id: number;
  username: string;
  name: string;
  role: string;
}

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref(localStorage.getItem('token') || '');
  const userInfo = ref<UserInfo | null>(null);

  // 登录
  async function login(username: string, password: string) {
    const res: any = await loginApi(username, password);

    if (res.success) {
      token.value = res.data.token;
      userInfo.value = res.data.user;
      localStorage.setItem('token', res.data.token);
      return true;
    }

    return false;
  }

  // 获取用户信息
  async function fetchUserInfo() {
    const res: any = await getMeApi();

    if (res.success) {
      userInfo.value = res.data;
      return true;
    }

    return false;
  }

  // 登出
  function logout() {
    token.value = '';
    userInfo.value = null;
    localStorage.removeItem('token');
  }

  return {
    token,
    userInfo,
    login,
    fetchUserInfo,
    logout,
  };
});
