/**
 * 计费单价 service（plan.md 第 8.5 节）
 * point_prices 为全局表（tenant_id=0 全局默认价，非 0 为租户自定义价）
 */
import { prisma } from '../../common/prisma.js';
import { getTenantContext } from '../../common/tenant-context.js';

export const priceService = {
  /**
   * 查询单价：租户自定义价优先于全局默认价
   * @param agentType agent 类型（report/copywriting/chat），不传则返回全部
   */
  async list(agentType?: string) {
    const { tenantId } = getTenantContext();
    const rows = await prisma.pointPrice.findMany({
      where: {
        tenantId: { in: [0n, tenantId] },
        ...(agentType ? { agentType } : {}),
        status: 1,
      },
      orderBy: { tenantId: 'asc' }, // 租户行（大 id）在后，合并时覆盖全局行
    });

    // 合并：同 agentType 下租户自定义价覆盖全局默认价
    const merged = new Map(rows.map((r) => [r.agentType, r]));
    return Array.from(merged.values()).map((r) => ({
      agentType: r.agentType,
      price: r.price,
      isCustom: r.tenantId !== 0n, // 是否租户自定义价
    }));
  },

  /** 更新（或创建）当前租户的某 agent 单价 */
  async update(agentType: string, price: number) {
    const { tenantId } = getTenantContext();
    const row = await prisma.pointPrice.upsert({
      where: { agentType_tenantId: { agentType, tenantId } },
      update: { price },
      create: { agentType, tenantId, price, status: 1 },
    });
    return { agentType: row.agentType, price: row.price };
  },
};
