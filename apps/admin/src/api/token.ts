/**
 * token 与用户信息的 localStorage 存取
 * 独立于 Pinia，供 axios 拦截器与路由守卫直接读取，避免循环依赖
 */
import type { UserInfo } from './types';

const ACCESS_KEY = 'artedu_access';
const REFRESH_KEY = 'artedu_refresh';
const USER_KEY = 'artedu_user';

/** 读取 access token */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

/** 读取 refresh token */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

/** 登录/续期成功后保存 token 对与用户信息 */
export function saveAuth(access: string, refresh: string, user: UserInfo): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** 读取缓存的用户信息（无缓存或解析失败返回 null） */
export function getStoredUser(): UserInfo | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

/** 清空登录态（登出或续期失败时调用） */
export function clearAuth(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
