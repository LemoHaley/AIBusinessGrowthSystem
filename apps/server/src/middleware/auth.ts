/**
 * 登录守卫（plan.md 第 8 节：需登录接口由 requireAuth / requireRole 守卫）
 * tenantMiddleware 已解析合法 token 时，上下文必然存在；否则返回 40001
 */
import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '@artedu/shared';
import { tenantStorage } from '../common/tenant-context.js';
import { ApiError } from '../common/response.js';

/** 要求已登录：无租户上下文（未带/无效 token）返回 40001 */
export function requireAuth(_req: Request, _res: Response, next: NextFunction): void {
  const ctx = tenantStorage.getStore();
  if (!ctx) {
    next(new ApiError(ERROR_CODES.UNAUTHORIZED, '未登录或 token 失效', 401));
    return;
  }
  next();
}
