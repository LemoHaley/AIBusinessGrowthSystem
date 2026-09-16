/**
 * 认证模块 controller：薄层，zod 参数校验 + 调 service + 组装响应
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok } from '../../common/response.js';
import { getTenantContext } from '../../common/tenant-context.js';
import { authService } from './auth.service.js';

const adminLoginSchema = z.object({
  phone: z.string().min(1, '手机号不能为空'),
  password: z.string().min(1, '密码不能为空'),
  tenantId: z.coerce.number().int().positive().default(1), // MVP 默认租户 1
});

const wxLoginSchema = z.object({
  code: z.string().min(1, 'code 不能为空'),
  tenantId: z.coerce.number().int().positive().default(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken 不能为空'),
});

export const authController = {
  /** POST /api/auth/admin-login：后台账号密码登录 */
  async adminLogin(req: Request, res: Response): Promise<void> {
    const input = adminLoginSchema.parse(req.body);
    res.json(ok(await authService.adminLogin(input)));
  },

  /** POST /api/auth/wx-login：小程序登录 */
  async wxLogin(req: Request, res: Response): Promise<void> {
    const input = wxLoginSchema.parse(req.body);
    res.json(ok(await authService.wxLogin(input)));
  },

  /** POST /api/auth/refresh：刷新 token 对 */
  async refresh(req: Request, res: Response): Promise<void> {
    const input = refreshSchema.parse(req.body);
    res.json(ok(await authService.refresh(input)));
  },

  /** POST /api/auth/logout：登出（吊销 refresh token） */
  async logout(_req: Request, res: Response): Promise<void> {
    const { userId } = getTenantContext();
    await authService.logout(userId);
    res.json(ok(null));
  },

  /** GET /api/auth/me：当前用户信息 */
  async me(_req: Request, res: Response): Promise<void> {
    const { userId } = getTenantContext();
    res.json(ok(await authService.me(userId)));
  },
};
