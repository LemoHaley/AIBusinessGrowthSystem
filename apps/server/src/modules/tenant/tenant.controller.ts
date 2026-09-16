/**
 * 机构模块控制器
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ERROR_CODES } from '@artedu/shared';
import { ApiError, ok } from '../../common/response.js';
import { tenantService } from './tenant.service.js';

const updateSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  logo: z.string().max(255).optional(),
  contact: z.string().max(64).optional(),
});

export const tenantController = {
  /** GET /api/tenant 当前机构信息 */
  async info(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.json(ok(await tenantService.getTenantInfo()));
  },

  /** POST /api/tenant/update 更新机构信息 */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await tenantService.updateTenant(parsed.data)));
  },
};
