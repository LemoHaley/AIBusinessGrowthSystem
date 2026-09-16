/**
 * Prisma 客户端 + 租户扩展（plan.md 第 5.3 节，核心防串号机制）
 *
 * 所有租户维度表的查询必须走本实例：
 * - 读/改/删：where 强制覆盖 tenantId（调用方传入的其他 tenantId 会被上下文值替换）
 * - 写：data 强制覆盖 tenantId
 * - 无上下文查询租户表立即抛 TENANT_CONTEXT_MISSING（防止越权查询漏网）
 * - 定时任务等无请求链路场景需显式用 runWithTenantContext 注入上下文
 *
 * 全局表（tenants / pointPrice / agentConfig）不在白名单内，不注入过滤。
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma 动态模型扩展无法给出精确类型，与官方文档写法一致 */
import { PrismaClient } from '@prisma/client';
import { getTenantContext } from './tenant-context.js';

/** 需要租户隔离的模型白名单（Prisma model 属性名，单驼峰） */
export const TENANT_MODELS = [
  'user',
  'class',
  'student',
  'pointAccount',
  'pointLedger',
  'aiLog',
  'knowledgeDoc',
  'aiReport',
] as const;

/** where 需要强制注入 tenantId 的操作（读/改/删/upsert） */
const WHERE_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

function withTenantQuery() {
  return {
    async $allOperations({ operation, args, query }: any) {
      // 无上下文直接抛错，由全局 errorHandler 转为 50000 并记录日志
      const { tenantId } = getTenantContext();

      if (WHERE_OPS.has(operation)) {
        // 展平合并：强制覆盖 tenantId，调用方无法传入其他租户
        args.where = { ...args.where, tenantId };
      }
      if (operation === 'create') {
        // 创建：data 强制覆盖 tenantId
        args.data = { ...args.data, tenantId };
      } else if (operation === 'createMany') {
        // 批量创建：逐条覆盖
        args.data = (args.data as object[]).map((d) => ({ ...d, tenantId }));
      } else if (operation === 'upsert') {
        // upsert：where 注入过滤 + create 分支覆盖；update 分支不涉及 tenantId
        args.where = { ...args.where, tenantId };
        args.create = { ...args.create, tenantId };
      }
      return query(args);
    },
  };
}

const base = new PrismaClient();

// 为白名单内每个模型挂载租户扩展（动态 key 无法精确类型化，整体断言）
const queryExt: Record<string, ReturnType<typeof withTenantQuery>> = {};
for (const m of TENANT_MODELS) queryExt[m] = withTenantQuery();

export const prisma = base.$extends({ query: queryExt } as any);
