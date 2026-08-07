import { defineStore } from 'pinia';
import { ref } from 'vue';
import { loginApi } from '@/api/auth';
import { getUserById } from '@/api/user';

interface UserInfo {
  id: number;
  username: string;
  realName: string;
  email: string;
  roles: string[];
  isActive: boolean;
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
      localStorage.setItem('userId', String(res.data.user.id));
      return true;
    }

    return false;
  }

  // 获取用户信息（通过用户 ID）
  async function fetchUserInfo() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      return false;
    }

    const res: any = await getUserById(Number(userId));

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
    localStorage.removeItem('userId');
  }

  return {
    token,
    userInfo,
    login,
    fetchUserInfo,
    logout,
  };
});
