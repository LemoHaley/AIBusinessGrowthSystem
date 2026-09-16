/**
 * 机构模块路由（plan.md 第 8.2 节）
 * 查询 teacher 可见；更新仅 admin
 */
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantController } from './tenant.controller.js';

export const tenantRoutes: Router = Router();

// 当前机构信息
tenantRoutes.get('/', requireRole('teacher'), asyncHandler(tenantController.info));

// 更新机构信息（写操作，POST）
tenantRoutes.post('/update', requireRole('admin'), asyncHandler(tenantController.update));
