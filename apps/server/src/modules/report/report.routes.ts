/**
 * 报告模块路由（plan.md 第 8.4 节）
 * 最低角色 parent（parent 行级过滤在 service 层实现）
 */
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireRole } from '../../middleware/rbac.js';
import { reportController } from './report.controller.js';

export const reportRoutes: Router = Router();

// 报告列表
reportRoutes.get('/list', requireRole('parent'), asyncHandler(reportController.list));

// 报告详情
reportRoutes.get('/detail', requireRole('parent'), asyncHandler(reportController.detail));
