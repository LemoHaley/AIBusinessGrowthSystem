/**
 * AI 中台模块路由（plan.md 阶段 5.3 / 8.3）
 * 配置与日志为 admin；对话 / 点评 / 文案生成开放 teacher（admin 角色等级更高同样可用）
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

// AI 对话（默认 SSE 流式，stream=false 非流式）
aiRoutes.post('/chat', requireRole('teacher'), asyncHandler(aiController.chat));

// 生成学员点评（body 含 bizId + studentId + 课堂表现）
aiRoutes.post(
  '/report/generate',
  requireRole('teacher'),
  asyncHandler(aiController.reportGenerate),
);

// 生成招生文案（body 含 bizId + 机构特色）
aiRoutes.post(
  '/copywriting/generate',
  requireRole('teacher'),
  asyncHandler(aiController.copywritingGenerate),
);
