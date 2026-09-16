/**
 * 租户上下文注入中间件（plan.md 第 5.2 节）
 * 解析 JWT payload 后用 tenantStorage.run 包裹整个下游调用链，
 * 后续中间件、controller、service 均运行在该上下文内。
 * 无效/无 token 放行，由阶段 3 的 requireAuth 拦截返回 40001。
 */
import type { NextFunction, Request, Response } from 'express';
import { tenantStorage } from '../common/tenant-context.js';
import { verifyAccessToken } from '../modules/auth/auth.jwt.js';

export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next(); // 公开接口放行
  try {
    const payload = verifyAccessToken(token);
    tenantStorage.run(
      {
        // JWT payload 为 number（JSON 可序列化），入库前转为 BigInt 与 Prisma 对齐
        tenantId: BigInt(payload.tenantId),
        userId: BigInt(payload.userId),
        role: payload.role,
      },
      () => next(),
    );
  } catch {
    next(); // 无效 token 放行，由 requireAuth 返回 40001（阶段 3）
  }
}
