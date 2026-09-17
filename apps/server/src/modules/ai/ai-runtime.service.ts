/**
 * AI 调用编排与计费闭环（plan.md 阶段 5.3 / 5.4）
 *
 * 时序：
 * 1. 取生效 Agent 配置（provider/model/prompt）与计费单价（租户自定义优先）
 * 2. deductPoints(bizId)：余额不足 40901 / 重复 bizId 40902，调用未发生不回滚
 * 3. 调 Provider（传入 onChunk 即流式，否则一次性返回）
 * 4. 成功：写 consume 流水 + ai_logs；报告类再写 ai_reports
 * 5. 失败：rollbackPoints 回滚余额（内部补记借贷相抵的流水）+ 写失败 ai_logs，抛 AI_FAILED
 *
 * bizId 由前端生成并在网络重试时复用，同一 bizId 只扣一次费。
 */
import { ERROR_CODES } from '@artedu/shared';
import { prisma } from '../../common/prisma.js';
import { ApiError } from '../../common/response.js';
import { getTenantContext } from '../../common/tenant-context.js';
import { deductPoints, recordConsume, rollbackPoints } from '../points/points.service.js';
import { priceService } from '../points/price.service.js';
import { resolveAgent, type AgentType } from './agent-resolve.service.js';
import { openaiProvider } from './providers/openai.provider.js';
import type { AiProvider, ProviderMessage } from './providers/provider.interface.js';

type ReportType = 'daily' | 'weekly' | 'monthly';

/** runAi 入参：三类 Agent 各自使用的字段 */
export interface RunAiInput {
  agentType: AgentType;
  /** 前端生成的业务单号（幂等键，重试复用） */
  bizId: string;
  /** AI 对话：本轮提问 */
  message?: string;
  /** AI 对话：历史多轮（不含本轮提问） */
  history?: { role: 'user' | 'assistant'; content: string }[];
  /** AI 点评：学员 ID */
  studentId?: bigint;
  /** AI 点评：课堂表现 */
  performance?: string;
  /** AI 点评：报告类型，默认 daily */
  reportType?: ReportType;
  /** 招生文案：机构特色 */
  features?: string;
  /** 招生文案：活动主题 */
  topic?: string;
  /** 传入则走流式：每个文本增量触发一次；不传则一次性返回 */
  onChunk?: (delta: string) => void;
}

/** runAi 结果 */
export interface RunAiResult {
  content: string;
  /** 本次实际消耗积分 */
  costPoints: number;
  /** 报告类返回新建的 ai_reports 主键，供前端编辑后回存 */
  reportId?: number;
}

/**
 * 按生效配置选择服务商。
 * Coze/Dify 凭证未就绪，直接报错提示运营在线切换，不做静默降级。
 */
function pickProvider(provider: 'coze' | 'dify' | 'openai'): AiProvider {
  if (provider === 'openai') return openaiProvider;
  throw new ApiError(
    ERROR_CODES.AI_FAILED,
    `服务商 ${provider} 尚未接入，请在「Agent 配置」中切换为 OpenAI 兼容并填写模型名`,
  );
}

/** 将 Provider 抛出的异常归一化为带 AI_FAILED 码的业务错误（保留 ApiError 原样） */
function toAiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const detail = err instanceof Error ? err.message : '未知错误';
  return new ApiError(ERROR_CODES.AI_FAILED, `AI 生成失败，积分已回滚：${detail}`);
}

/**
 * 执行一次 AI 调用并完成计费闭环。
 * 由控制器在校验通过后调用；参数/鉴权错误在调用前由路由与校验层拦截。
 */
export async function runAi(input: RunAiInput): Promise<RunAiResult> {
  const { tenantId, userId } = getTenantContext();
  const cfg = await resolveAgent(input.agentType);

  // ---------- 1. 组装消息（system 用 promptTemplate，user 为具体业务输入） ----------
  const messages: ProviderMessage[] = [];
  if (cfg.promptTemplate) messages.push({ role: 'system', content: cfg.promptTemplate });

  let prompt: string;
  let reportMeta: {
    studentId: bigint;
    classId: bigint | null;
    reportType: ReportType;
  } | null = null;

  if (input.agentType === 'chat') {
    for (const item of input.history ?? []) {
      messages.push({ role: item.role, content: item.content });
    }
    prompt = input.message ?? '';
    messages.push({ role: 'user', content: prompt });
  } else if (input.agentType === 'copywriting') {
    prompt = `机构特色：${input.features ?? ''}\n活动主题：${
      input.topic ?? '常规招生'
    }\n请据此生成一条适合发布的招生文案。`;
    messages.push({ role: 'user', content: prompt });
  } else {
    // 点评：校验学员归属本租户（租户扩展自动注入 tenantId 过滤）
    const student = await prisma.student.findUnique({ where: { id: input.studentId ?? 0n } });
    if (!student) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, '学员不存在', 404);
    }
    reportMeta = {
      studentId: student.id,
      classId: student.classId,
      reportType: input.reportType ?? 'daily',
    };
    prompt = `学员姓名：${student.name}\n当前级别：${
      student.level ?? '未分级'
    }\n课堂表现：${input.performance ?? ''}\n请生成一份课后点评。`;
    messages.push({ role: 'user', content: prompt });
  }

  // ---------- 2. 计费单价（租户自定义价优先于全局默认价） ----------
  const prices = await priceService.list(input.agentType);
  const price = prices[0]?.price;
  if (price === undefined) {
    throw new ApiError(ERROR_CODES.AI_FAILED, '未配置该功能的计费单价，请先在「计价配置」中设置');
  }

  const provider = pickProvider(cfg.provider);

  // ---------- 3. 扣费（bizId 幂等；此处失败说明调用未发生，直接抛出不回滚） ----------
  const balanceAfter = await deductPoints({ userId, amount: price, bizId: input.bizId });

  // ---------- 4. 调 Provider ----------
  const startedAt = Date.now();
  let content: string;
  let tokensInput: number | null;
  let tokensOutput: number | null;
  try {
    const invokeParams = { model: cfg.model, messages };
    const result = input.onChunk
      ? await provider.chatStream(invokeParams, input.onChunk)
      : await provider.chat(invokeParams);
    content = result.content;
    tokensInput = result.tokensInput ?? null;
    tokensOutput = result.tokensOutput ?? null;
  } catch (err) {
    // 调用失败：回滚积分并记录失败日志，再抛错给前端提示
    await rollbackPoints({ userId, amount: price, originalBizId: input.bizId }).catch(
      () => undefined,
    );
    await prisma.aiLog
      .create({
        data: {
          tenantId,
          userId,
          agentType: input.agentType,
          prompt,
          response: null,
          tokensInput: null,
          tokensOutput: null,
          costPoints: null,
          durationMs: Date.now() - startedAt,
          status: 0,
        },
      })
      .catch(() => undefined);
    throw toAiError(err);
  }

  // 空输出按失败处理，同样回滚，避免为无效结果扣费
  if (!content.trim()) {
    await rollbackPoints({ userId, amount: price, originalBizId: input.bizId }).catch(
      () => undefined,
    );
    await prisma.aiLog
      .create({
        data: {
          tenantId,
          userId,
          agentType: input.agentType,
          prompt,
          response: null,
          tokensInput: null,
          tokensOutput: null,
          costPoints: null,
          durationMs: Date.now() - startedAt,
          status: 0,
        },
      })
      .catch(() => undefined);
    throw new ApiError(ERROR_CODES.AI_FAILED, 'AI 返回内容为空，积分已回滚');
  }

  // ---------- 5. 成功：consume 流水 + 报告落库 + 成功日志 ----------
  await recordConsume({
    userId,
    amount: price,
    bizId: input.bizId,
    bizType: input.agentType,
    balanceAfter,
  });

  let reportId: number | undefined;
  if (input.agentType === 'report' && reportMeta) {
    const report = await prisma.aiReport.create({
      data: {
        tenantId,
        studentId: reportMeta.studentId,
        classId: reportMeta.classId,
        teacherId: userId,
        content,
        reportType: reportMeta.reportType,
        costPoints: price,
        status: 1,
      },
    });
    reportId = Number(report.id);
  }

  await prisma.aiLog.create({
    data: {
      tenantId,
      userId,
      agentType: input.agentType,
      prompt,
      response: content,
      tokensInput,
      tokensOutput,
      costPoints: price,
      durationMs: Date.now() - startedAt,
      status: 1,
    },
  });

  return { content, costPoints: price, reportId };
}
