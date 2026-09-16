/**
 * AI 中台模块路由（plan.md 第 8.3 节本地子集，均 admin）
 * AI 对话/生成接口（chat、report/generate、copywriting/generate）属阶段 5
 */
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireRole } from '../../middleware/rbac.js';
import { aiController } from './ai.controller.js';

export const aiRoutes: Router = Router();

// Agent 配置列表
aiRoutes.get('/agents', requireRole('admin'), asyncHandler(aiController.agents));

// 更新 Agent 配置（写操作，POST）
aiRoutes.post('/agents/update', requireRole('admin'), asyncHandler(aiController.agentUpdate));

// AI 调用日志（分页/筛选）
aiRoutes.get('/logs', requireRole('admin'), asyncHandler(aiController.logs));
