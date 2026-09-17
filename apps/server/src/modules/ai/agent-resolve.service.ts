/**
 * Agent 运行时配置解析（plan.md 阶段 5.1）
 * 按 agentType 读取 agent_configs：当前租户自定义行优先，tenant_id=0 全局默认行兜底。
 * AgentConfig 为全局表（不走租户扩展），此处显式按 tenantId 查两行合并。
 */
import { prisma } from '../../common/prisma.js';
import { getTenantContext } from '../../common/tenant-context.js';

/** 三类内置 Agent */
export type AgentType = 'report' | 'copywriting' | 'chat';

/** 生效中的 Agent 配置 */
export interface ResolvedAgent {
  provider: 'coze' | 'dify' | 'openai';
  botId: string | null;
  model: string | null;
  promptTemplate: string | null;
}

/** 查询某类 Agent 的生效配置（租户行覆盖全局行；均不存在时返回 openai 空配置） */
export async function resolveAgent(agentType: AgentType): Promise<ResolvedAgent> {
  const { tenantId } = getTenantContext();
  const [globalRow, tenantRow] = await Promise.all([
    prisma.agentConfig.findUnique({
      where: { agentType_tenantId: { agentType, tenantId: 0n } },
    }),
    prisma.agentConfig.findUnique({
      where: { agentType_tenantId: { agentType, tenantId } },
    }),
  ]);

  const row = tenantRow ?? globalRow;
  if (!row) {
    return { provider: 'openai', botId: null, model: null, promptTemplate: null };
  }
  return {
    provider: row.provider,
    botId: row.botId,
    model: row.model,
    promptTemplate: row.promptTemplate,
  };
}
