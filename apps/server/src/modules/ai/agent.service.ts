/**
 * Agent 配置与 AI 日志服务（plan.md 第 8.3 节本地子集）
 * AgentConfig 为全局表（tenantId=0 全局行 + 租户自定义行，不走租户扩展）
 * AiLog 在租户扩展白名单内，自动注入 tenantId
 * 注：AI 调用本体（Coze/流式/扣积分）属阶段 5，此处仅落地纯 DB 读写接口
 */
import { prisma } from '../../common/prisma.js';
import { getTenantContext } from '../../common/tenant-context.js';

/** Agent 配置列表（全局默认 + 租户自定义合并，租户行优先，附 isCustom 标记） */
async function listAgents() {
  const { tenantId } = getTenantContext();
  const [globalRows, tenantRows] = await Promise.all([
    prisma.agentConfig.findMany({ where: { tenantId: 0n } }),
    prisma.agentConfig.findMany({ where: { tenantId } }),
  ]);

  const map = new Map<string, Record<string, unknown>>();
  for (const row of globalRows) {
    map.set(row.agentType, { ...row, isCustom: false });
  }
  for (const row of tenantRows) {
    map.set(row.agentType, { ...row, isCustom: true }); // 租户自定义覆盖同类型全局配置
  }
  return [...map.values()];
}

/** 更新租户 Agent 配置（upsert：provider / botId / model / promptTemplate） */
async function updateAgent(input: {
  agentType: string;
  provider?: 'coze' | 'dify' | 'openai';
  botId?: string;
  model?: string;
  promptTemplate?: string;
}) {
  const { tenantId } = getTenantContext();
  const data: {
    provider?: 'coze' | 'dify' | 'openai';
    botId?: string;
    model?: string;
    promptTemplate?: string;
  } = {};
  if (input.provider !== undefined) data.provider = input.provider;
  if (input.botId !== undefined) data.botId = input.botId;
  if (input.model !== undefined) data.model = input.model;
  if (input.promptTemplate !== undefined) data.promptTemplate = input.promptTemplate;

  return await prisma.agentConfig.upsert({
    where: { agentType_tenantId: { agentType: input.agentType, tenantId } },
    create: { agentType: input.agentType, tenantId, ...data },
    update: data,
  });
}

/** AI 调用日志列表（分页，按 agentType / status 筛选） */
async function listLogs(input: {
  page: number;
  pageSize: number;
  agentType?: string;
  status?: number;
}) {
  const where: { agentType?: string; status?: number } = {};
  if (input.agentType) where.agentType = input.agentType;
  if (input.status !== undefined) where.status = input.status;

  const [rows, total] = await Promise.all([
    prisma.aiLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.aiLog.count({ where }),
  ]);
  return { rows, total, page: input.page, pageSize: input.pageSize };
}

export const agentService = { listAgents, updateAgent, listLogs };
