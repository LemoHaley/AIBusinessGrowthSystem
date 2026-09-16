/**
 * 积分账本核心（plan.md 第 7 节）
 * Redis 热点余额（Lua 原子扣减防超发）+ MySQL 流水（uk_biz 幂等最后防线）+ 失败回滚
 *
 * 注意：所有 prisma 写入（pointAccount/pointLedger）走租户扩展，必须在请求上下文内调用；
 * 定时对账任务用 runWithTenantContext 显式注入。
 */
import fs from 'node:fs';
import { ERROR_CODES } from '@artedu/shared';
import { prisma } from '../../common/prisma.js';
import { redis } from '../../common/redis.js';
import { ApiError } from '../../common/response.js';
import { getTenantContext } from '../../common/tenant-context.js';

// Lua 脚本一次性读入（src 与 dist 目录深度一致，相对路径两者通用）
const deductScript = fs.readFileSync(
  new URL('../../../scripts/lua/deduct_points.lua', import.meta.url),
  'utf-8',
);

/** 幂等锁过期时间（秒）：覆盖前端最长重试窗口 */
const LOCK_TTL_SECONDS = 300;

/** 余额 Redis key：points:balance:{tenantId}:{userId} */
function balanceKey(tenantId: bigint, userId: bigint): string {
  return `points:balance:${tenantId}:${userId}`;
}

/**
 * 余额缓存预热（plan.md 第 7.3 节）
 * Redis 重启或 key 丢失时从 point_accounts 加载，避免"有积分却扣不了"
 * （key 不存在时 Lua 读到 0 直接拒绝）
 *
 * SET NX：仅当 key 不存在时写入，防止覆盖并发期间的充值
 */
export async function ensureBalanceLoaded(tenantId: bigint, userId: bigint): Promise<void> {
  const key = balanceKey(tenantId, userId);
  if ((await redis.exists(key)) === 1) return;

  // 请求链路内调用，租户扩展自动过滤 tenantId
  const account = await prisma.pointAccount.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  await redis.set(key, account?.balance ?? 0, 'NX');
}

/**
 * 原子扣减（防超发核心）
 * 幂等锁命中抛 40902；余额不足抛 40901
 * @returns 扣减后余额
 */
export async function deductPoints(params: {
  userId: bigint;
  amount: number;
  bizId: string;
}): Promise<number> {
  const { tenantId } = getTenantContext();
  // 扣减前确保 Redis 余额已初始化（防 key 丢失导致误判余额为 0）
  await ensureBalanceLoaded(tenantId, params.userId);

  const result = (await redis.eval(
    deductScript,
    2,
    balanceKey(tenantId, params.userId),
    `points:lock:${params.bizId}`,
    params.amount,
    LOCK_TTL_SECONDS,
  )) as number;

  if (result === -1) {
    throw new ApiError(ERROR_CODES.POINTS_INSUFFICIENT, '积分余额不足', 409);
  }
  if (result === -2) {
    throw new ApiError(ERROR_CODES.DUPLICATE_REQUEST, '重复请求，请勿重复提交', 409);
  }
  return result;
}

/**
 * 失败回滚（AI 调用失败时自动触发，plan.md 第 7.4 节）
 * 不修改原流水，新增一条 rollback 反向流水
 *
 * 账目平衡说明：consume 流水按 plan.md 第 6.4 节由 AI 成功路径写入，
 * 失败路径此前只有 Redis 扣减、没有对应负向流水；若此处只写 rollback 正向流水，
 * 流水聚合将比真实余额多出 amount，对账任务会把差额"修复"进 Redis（白送积分）。
 * 因此回滚时先补写原扣减的 consume 流水（-amount，占住 uk_biz 幂等位，
 * 同 bizId 重试撞唯一约束即被数据库拒绝），再写 rollback 反向流水，借贷相抵。
 * @returns 回滚后余额
 */
export async function rollbackPoints(params: {
  userId: bigint;
  amount: number;
  originalBizId: string;
}): Promise<number> {
  const { tenantId } = getTenantContext();
  const key = balanceKey(tenantId, params.userId);

  // 补写原扣减的 consume 流水（当前 Redis 值即扣减后余额，作为 balanceAfter 快照）
  const balanceBefore = Number(await redis.get(key));
  await prisma.pointLedger.create({
    data: {
      tenantId,
      userId: params.userId,
      changeType: 'consume',
      changeAmount: -params.amount, // 负数减少
      balanceAfter: balanceBefore,
      bizId: params.originalBizId,
      bizType: 'rollback',
      remark: `AI 调用失败，补记扣减 ${params.originalBizId}`,
    },
  });

  // Redis 加回余额
  const balance = await redis.incrby(key, params.amount);

  // 写反向流水（bizId 加 rollback: 前缀，不占用原 bizId 的 uk_biz 约束位）
  await prisma.pointLedger.create({
    data: {
      tenantId,
      userId: params.userId,
      changeType: 'rollback',
      changeAmount: params.amount, // 正数加回
      balanceAfter: balance,
      bizId: `rollback:${params.originalBizId}`,
      bizType: 'rollback',
      remark: `回滚 ${params.originalBizId}`,
    },
  });
  return balance;
}

/**
 * 充值（Redis INCRBY + recharge 流水同步落库）
 * @returns 充值后余额
 */
export async function rechargePoints(params: {
  userId: bigint;
  amount: number;
  bizId: string;
}): Promise<number> {
  const { tenantId } = getTenantContext();
  const key = balanceKey(tenantId, params.userId);

  // 先预热再充值：保证 key 存在（INCRBY 对不存在的 key 视为 0 起增，语义等价，
  // 但预热可顺带把 MySQL 中已有余额同步进 Redis）
  await ensureBalanceLoaded(tenantId, params.userId);
  const balance = await redis.incrby(key, params.amount);

  await prisma.pointLedger.create({
    data: {
      tenantId,
      userId: params.userId,
      changeType: 'recharge',
      changeAmount: params.amount,
      balanceAfter: balance,
      bizId: params.bizId,
      bizType: 'recharge',
      remark: '积分充值',
    },
  });
  return balance;
}

/** 查询 Redis 中的当前余额（先预热，保证 key 存在） */
export async function getBalance(userId: bigint): Promise<number> {
  const { tenantId } = getTenantContext();
  await ensureBalanceLoaded(tenantId, userId);
  const value = await redis.get(balanceKey(tenantId, userId));
  return Number(value ?? 0);
}
