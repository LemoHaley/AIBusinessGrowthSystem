/**
 * 积分模块路由（plan.md 第 8.5 节）
 * 查询 teacher 可见；充值与改价仅 admin
 */
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireRole } from '../../middleware/rbac.js';
import { pointsController } from './points.controller.js';

export const pointsRoutes: Router = Router();

// 当前用户余额
pointsRoutes.get('/balance', requireRole('teacher'), asyncHandler(pointsController.balance));

// 充值（写操作，POST）
pointsRoutes.post('/recharge', requireRole('admin'), asyncHandler(pointsController.recharge));

// 流水分页查询
pointsRoutes.get('/ledger', requireRole('teacher'), asyncHandler(pointsController.ledger));

// 计费单价查询
pointsRoutes.get('/prices', requireRole('teacher'), asyncHandler(pointsController.prices));

// 更新计费单价（写操作，POST）
pointsRoutes.post(
  '/prices/update',
  requireRole('admin'),
  asyncHandler(pointsController.priceUpdate),
);
