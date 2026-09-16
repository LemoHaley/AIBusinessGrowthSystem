/**
 * 健康检查 controller：薄层，仅组装响应
 */
import type { Request, Response } from 'express';
import { ok } from '../../common/response.js';
import { healthService } from './health.service.js';

export const healthController = {
  /** GET /api/health */
  async check(_req: Request, res: Response): Promise<void> {
    const data = await healthService.check();
    res.json(ok(data));
  },
};
