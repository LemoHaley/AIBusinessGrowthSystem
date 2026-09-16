/**
 * 报告模块控制器
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ERROR_CODES } from '@artedu/shared';
import { ApiError, ok } from '../../common/response.js';
import { reportService } from './report.service.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  studentId: z.coerce.bigint().optional(),
});
const detailQuerySchema = z.object({ id: z.coerce.bigint() });

export const reportController = {
  /** GET /api/report/list 报告列表（parent 只能看自己孩子的） */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await reportService.listReports(parsed.data)));
  },

  /** GET /api/report/detail 报告详情 */
  async detail(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = detailQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await reportService.getReportDetail(parsed.data.id)));
  },
};
