/**
 * AI 中台模块控制器（本地子集：配置与日志）
 * AI 对话/生成接口属阶段 5（依赖 Coze 凭证），此处不实现
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ERROR_CODES } from '@artedu/shared';
import { ApiError, ok } from '../../common/response.js';
import { agentService } from './agent.service.js';

const logsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  agentType: z.string().max(32).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

const agentUpdateSchema = z.object({
  agentType: z.enum(['report', 'copywriting', 'chat']),
  provider: z.enum(['coze', 'dify', 'openai']).optional(),
  botId: z.string().max(128).optional(),
  model: z.string().max(64).optional(),
  promptTemplate: z.string().optional(),
});

export const aiController = {
  /** GET /api/ai/agents Agent 配置列表 */
  async agents(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.json(ok(await agentService.listAgents()));
  },

  /** POST /api/ai/agents/update 更新 Agent 配置 */
  async agentUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = agentUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await agentService.updateAgent(parsed.data)));
  },

  /** GET /api/ai/logs AI 调用日志（分页/筛选） */
  async logs(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = logsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await agentService.listLogs(parsed.data)));
  },
};
