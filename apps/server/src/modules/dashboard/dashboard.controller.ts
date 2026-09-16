/**
 * 数据看板模块控制器
 */
import type { NextFunction, Request, Response } from 'express';
import { ok } from '../../common/response.js';
import { dashboardService } from './dashboard.service.js';

export const dashboardController = {
  /** GET /api/dashboard/summary 经营数据总览 */
  async summary(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.json(ok(await dashboardService.getSummary()));
  },
};
