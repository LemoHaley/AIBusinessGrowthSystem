/**
 * 租户上下文（plan.md 第 5.1 节）
 * 基于 AsyncLocalStorage：tenantMiddleware 注入后，同一请求链路内任意层均可安全读取
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from '@artedu/shared';

/** 单次请求的租户上下文（由 JWT payload 解析而来） */
export interface TenantContext {
  /** BigInt 与 Prisma schema 保持一致（tenant_id BIGINT） */
  tenantId: bigint;
  userId: bigint;
  role: Role;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * 获取当前请求的租户上下文
 * 未注入时抛错——配合 Prisma 租户扩展，保证越权查询无法漏网
 */
export function getTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) throw new Error('TENANT_CONTEXT_MISSING');
  return ctx;
}

/**
 * 显式注入上下文执行（定时任务/后台脚本等无请求链路场景使用）
 * @example tenantStorage.run({ tenantId: 1n, userId: 0n, role: 'admin' }, () => ...)
 */
export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStorage.run(ctx, fn);
}
