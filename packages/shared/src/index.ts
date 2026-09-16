/**
 * @artedu/shared 三端共享包
 * 存放跨端复用的 TypeScript 类型、常量与工具函数（plan.md 第 3 节）
 */

/** 应用名称 */
export const APP_NAME = 'ArtEdu AI';

/**
 * 统一错误码（plan.md 第 1.3 节）
 * 成功返回 code=0；失败返回对应业务错误码，前端按 code 分支处理
 */
export const ERROR_CODES = {
  /** 成功 */
  OK: 0,
  /** 未登录或 token 失效 */
  UNAUTHORIZED: 40001,
  /** 无权限（角色不足） */
  FORBIDDEN: 40003,
  /** 参数校验失败 */
  PARAM_INVALID: 40004,
  /** 资源不存在 */
  NOT_FOUND: 40404,
  /** 积分余额不足 */
  POINTS_INSUFFICIENT: 40901,
  /** 重复请求（幂等拦截） */
  DUPLICATE_REQUEST: 40902,
  /** 服务器内部错误 */
  INTERNAL: 50000,
  /** AI 服务调用失败 */
  AI_FAILED: 50901,
} as const;

/** 统一响应结构：{ code, message, data } */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

/** 用户角色 */
export type Role = 'admin' | 'teacher' | 'parent';
