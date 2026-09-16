/**
 * 用户模块路由（plan.md 第 8.2 节）
 * 列表 teacher 可见；增改删仅 admin（写操作全 POST）
 */
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireRole } from '../../middleware/rbac.js';
import { userController } from './user.controller.js';

export const userRoutes: Router = Router();

// 用户列表（老师/家长，分页）
userRoutes.get('/list', requireRole('teacher'), asyncHandler(userController.list));

// 创建老师/管理员
userRoutes.post('/create', requireRole('admin'), asyncHandler(userController.create));

// 更新用户
userRoutes.post('/update', requireRole('admin'), asyncHandler(userController.update));

// 删除用户（软删）
userRoutes.post('/delete', requireRole('admin'), asyncHandler(userController.remove));
