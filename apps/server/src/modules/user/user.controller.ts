/**
 * 用户模块控制器
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ERROR_CODES } from '@artedu/shared';
import { ApiError, ok } from '../../common/response.js';
import { userService } from './user.service.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['admin', 'teacher', 'parent']).optional(),
});

const createSchema = z.object({
  phone: z.string().min(5).max(20),
  password: z.string().min(6).max(64),
  nickname: z.string().max(64).optional(),
  role: z.enum(['admin', 'teacher']), // 家长走小程序登录自动创建，不在此创建
});

const updateSchema = z.object({
  id: z.coerce.bigint(),
  nickname: z.string().max(64).optional(),
  phone: z.string().min(5).max(20).optional(),
  role: z.enum(['admin', 'teacher', 'parent']).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
  password: z.string().min(6).max(64).optional(),
});

const deleteSchema = z.object({ id: z.coerce.bigint() });

export const userController = {
  /** GET /api/user/list 用户列表（老师/家长） */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await userService.listUsers(parsed.data)));
  },

  /** POST /api/user/create 创建老师/管理员 */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await userService.createUser(parsed.data)));
  },

  /** POST /api/user/update 更新用户 */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await userService.updateUser(parsed.data)));
  },

  /** POST /api/user/delete 删除用户（软删） */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = deleteSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await userService.deleteUser(parsed.data.id)));
  },
};
