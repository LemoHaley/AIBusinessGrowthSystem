/**
 * 数据看板模块路由（plan.md 第 8.3 节）
 * 仅 admin 可见
 */
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireRole } from '../../middleware/rbac.js';
import { dashboardController } from './dashboard.controller.js';

export const dashboardRoutes: Router = Router();

// 经营数据总览
dashboardRoutes.get('/summary', requireRole('admin'), asyncHandler(dashboardController.summary));
