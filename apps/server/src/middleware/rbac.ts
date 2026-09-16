/**
 * RBAC 角色守卫（plan.md 第 5.4 节）
 * 角色等级：admin(3) > teacher(2) > parent(1)
 * 用法：router.post('/create', requireRole('admin'), handler)
 */
import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES, type Role } from '@artedu/shared';
import { tenantStorage } from '../common/tenant-context.js';
import { ApiError } from '../common/response.js';

/** 角色等级映射：数值越大权限越高 */
const ROLE_LEVEL: Record<Role, number> = { admin: 3, teacher: 2, parent: 1 };

/** 要求当前用户角色不低于 min：未登录 40001，等级不足 40003 */
export function requireRole(min: Role) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    const ctx = tenantStorage.getStore();
    if (!ctx) {
      next(new ApiError(ERROR_CODES.UNAUTHORIZED, '未登录或 token 失效', 401));
      return;
    }
    if (ROLE_LEVEL[ctx.role] < ROLE_LEVEL[min]) {
      next(new ApiError(ERROR_CODES.FORBIDDEN, '无权限', 403));
      return;
    }
    next();
  };
}
