/**
 * axios 统一封装（plan.md 阶段 8）
 * - 请求自动注入 Bearer access token
 * - 响应统一按 { code, message, data } 处理：code=0 由 get/post 泛型解包返回业务数据
 * - 40001（token 过期）：静默 refresh 续期后重放原请求，并发 401 共享同一次刷新
 * - 续期失败：清空登录态并跳转登录页
 */
import axios from 'axios';
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { ElMessage } from 'element-plus';
import { ERROR_CODES, type ApiResponse } from '@artedu/shared';
import type { TokenPair } from './types';
import { clearAuth, getAccessToken, getRefreshToken, saveAuth } from './token';

/** 后端业务错误（reject 时抛给调用方，调用方可按 code 分支处理） */
export class ApiBusinessError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiBusinessError';
  }
}

/** 已重放标记：防止续期后仍 401 时无限循环 */
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

const http = axios.create({ baseURL: '/api', timeout: 15000 });

// 请求拦截：注入 Bearer token
http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 刷新单例：并发 401 时共享同一次 refresh 请求
let refreshing: Promise<string> | null = null;

/** 调刷新接口（用裸 axios，避免经过拦截器造成递归） */
async function doRefresh(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('refresh token 不存在');
  const res = await axios.post<ApiResponse<TokenPair>>('/api/auth/refresh', { refreshToken });
  const body = res.data;
  if (body.code !== ERROR_CODES.OK || !body.data) {
    throw new Error(body.message || '刷新登录态失败');
  }
  saveAuth(body.data.access, body.data.refresh, body.data.user);
  return body.data.access;
}

/** 刷新 access token（导出供 SSE 流式请求复用，保证全应用共享同一次刷新单例） */
export function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/** 续期失败兜底：清空登录态并整页跳转登录页 */
function forceLogout(): void {
  clearAuth();
  ElMessage.error('登录已过期，请重新登录');
  window.location.href = '/login';
}

/** 静默续期后重放原请求；已重放过的请求不再二次尝试 */
async function replayAfterRefresh(config: RetriableConfig): Promise<AxiosResponse> {
  if (config._retried) {
    forceLogout();
    return Promise.reject(new ApiBusinessError(ERROR_CODES.UNAUTHORIZED, '登录已过期'));
  }
  config._retried = true;
  try {
    const access = await refreshAccessToken();
    config.headers.Authorization = `Bearer ${access}`;
    return await http.request(config);
  } catch {
    forceLogout();
    return Promise.reject(new ApiBusinessError(ERROR_CODES.UNAUTHORIZED, '登录已过期'));
  }
}

// 响应拦截：统一错误提示 + 401 静默续期
http.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse;
    if (body.code === ERROR_CODES.OK) return response;
    if (body.code === ERROR_CODES.UNAUTHORIZED) {
      return replayAfterRefresh(response.config as RetriableConfig);
    }
    // 业务失败：统一弹出后端 message
    ElMessage.error(body.message || '请求失败');
    return Promise.reject(new ApiBusinessError(body.code, body.message));
  },
  (error: AxiosError<ApiResponse>) => {
    const body = error.response?.data;
    // 后端鉴权失败返回 HTTP 401 + 业务码 40001
    if (body?.code === ERROR_CODES.UNAUTHORIZED && error.config) {
      return replayAfterRefresh(error.config as RetriableConfig);
    }
    const message = body?.message || '网络错误，请稍后重试';
    ElMessage.error(message);
    return Promise.reject(new ApiBusinessError(body?.code ?? ERROR_CODES.INTERNAL, message));
  },
);

/** GET 请求：params 为查询参数，返回 data 本体 */
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await http.get<ApiResponse<T>>(url, { params });
  return res.data.data as T;
}

/** POST 请求（写操作统一 POST），返回 data 本体 */
export async function post<T>(url: string, data?: unknown): Promise<T> {
  const res = await http.post<ApiResponse<T>>(url, data);
  return res.data.data as T;
}
