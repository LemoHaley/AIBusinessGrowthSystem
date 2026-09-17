/**
 * AI 中台模块控制器
 * - 本地子集：Agent 配置与调用日志（不依赖外部凭证）
 * - 阶段 5：AI 对话 / 点评生成 / 招生文案，走 OpenAI 兼容 Provider，SSE 流式 + 计费闭环
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ERROR_CODES } from '@artedu/shared';
import { ApiError, ok } from '../../common/response.js';
import { agentService } from './agent.service.js';
import { runAi, type RunAiInput } from './ai-runtime.service.js';
import { createSse } from './sse.js';

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

/** bizId 为前端生成的幂等键，三类调用均必传 */
const bizIdSchema = z.string().min(1).max(64);

const chatSchema = z.object({
  message: z.string().min(1, '请输入对话内容').max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
  bizId: bizIdSchema,
  /** false 走非流式 JSON，默认流式 SSE */
  stream: z.boolean().optional(),
});

const reportGenerateSchema = z.object({
  studentId: z.coerce.bigint().positive(),
  performance: z.string().min(1, '请输入课堂表现').max(4000),
  reportType: z.enum(['daily', 'weekly', 'monthly']).optional(),
  bizId: bizIdSchema,
  stream: z.boolean().optional(),
});

const copywritingGenerateSchema = z.object({
  features: z.string().min(1, '请输入机构特色').max(2000),
  topic: z.string().max(200).optional(),
  bizId: bizIdSchema,
  stream: z.boolean().optional(),
});

/** 统一处理 SSE 流式调用：chunk 推增量、done 给结果、error 给失败信息（积分已回滚） */
async function streamAi(res: Response, input: RunAiInput): Promise<void> {
  const sse = createSse(res);
  try {
    const result = await runAi({
      ...input,
      onChunk: (delta) => sse.send('chunk', { content: delta }),
    });
    sse.send('done', result);
  } catch (err) {
    sse.send('error', {
      code: err instanceof ApiError ? err.code : ERROR_CODES.AI_FAILED,
      message: err instanceof Error ? err.message : 'AI 调用失败',
    });
  } finally {
    sse.close();
  }
}

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

  /** POST /api/ai/chat AI 对话（默认 SSE 流式；stream=false 返回 JSON） */
  async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    const input: RunAiInput = {
      agentType: 'chat',
      bizId: parsed.data.bizId,
      message: parsed.data.message,
      history: parsed.data.history,
    };
    if (parsed.data.stream === false) {
      try {
        res.json(ok(await runAi(input)));
      } catch (err) {
        next(err);
      }
      return;
    }
    await streamAi(res, input);
  },

  /** POST /api/ai/report/generate 生成学员点评（默认 SSE 流式；成功落 ai_reports） */
  async reportGenerate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = reportGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    const input: RunAiInput = {
      agentType: 'report',
      bizId: parsed.data.bizId,
      studentId: parsed.data.studentId,
      performance: parsed.data.performance,
      reportType: parsed.data.reportType,
    };
    if (parsed.data.stream === false) {
      try {
        res.json(ok(await runAi(input)));
      } catch (err) {
        next(err);
      }
      return;
    }
    await streamAi(res, input);
  },

  /** POST /api/ai/copywriting/generate 生成招生文案（默认 SSE 流式） */
  async copywritingGenerate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = copywritingGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    const input: RunAiInput = {
      agentType: 'copywriting',
      bizId: parsed.data.bizId,
      features: parsed.data.features,
      topic: parsed.data.topic,
    };
    if (parsed.data.stream === false) {
      try {
        res.json(ok(await runAi(input)));
      } catch (err) {
        next(err);
      }
      return;
    }
    await streamAi(res, input);
  },
};
