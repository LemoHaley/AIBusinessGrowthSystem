/**
 * 登录态 Pinia store：登录/登出与角色信息
 * token 持久化在 localStorage（token.ts），store 仅持有用户信息
 */
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { post } from '@/api/http';
import { clearAuth, getStoredUser, saveAuth } from '@/api/token';
import type { TokenPair, UserInfo } from '@/api/types';

export const useAuthStore = defineStore('auth', () => {
  /** 当前登录用户（null 表示未登录） */
  const user = ref<UserInfo | null>(getStoredUser());

  /** 是否管理员 */
  const isAdmin = computed(() => user.value?.role === 'admin');

  /** 登录后首页：admin 进看板，teacher 进班级管理 */
  const homePath = computed(() => (isAdmin.value ? '/dashboard' : '/classes'));

  /** 账号密码登录（admin/teacher） */
  async function login(payload: {
    phone: string;
    password: string;
    tenantId: number;
  }): Promise<UserInfo> {
    const data = await post<TokenPair>('/auth/admin-login', payload);
    saveAuth(data.access, data.refresh, data.user);
    user.value = data.user;
    return data.user;
  }

  /** 登出：吊销 refresh token 并清空本地登录态 */
  async function logout(): Promise<void> {
    await post('/auth/logout');
    clearAuth();
    user.value = null;
  }

  return { user, isAdmin, homePath, login, logout };
});
