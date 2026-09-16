/**
 * 积分对账定时任务（plan.md 第 7.5 节，BullMQ 每 1 分钟）
 *
 * 以 MySQL point_ledger 流水聚合为唯一可信源：
 * - Redis 余额与流水不一致 -> 按流水修复 Redis + 告警日志
 * - upsert point_accounts 落地余额
 *
 * 遍历必须用 SCAN 游标（禁止 KEYS，生产环境会阻塞 Redis）
 */
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../common/logger.js';
import { prisma } from '../common/prisma.js';
import { redis } from '../common/redis.js';
import { runWithTenantContext } from '../common/tenant-context.js';

const QUEUE_NAME = 'points-reconcile';

// BullMQ 要求连接禁用重试上限（内部依赖阻塞命令）
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/** 对账单个余额 key：流水聚合为准，修复 Redis 并落地 MySQL */
async function reconcileKey(key: string): Promise<void> {
  // key 形如 points:balance:{tenantId}:{userId}
  const [, , tenantIdStr, userIdStr] = key.split(':');
  const tenantId = BigInt(tenantIdStr);
  const userId = BigInt(userIdStr);

  // 对账任务无请求上下文：显式注入后走租户扩展查询
  await runWithTenantContext({ tenantId, userId, role: 'admin' }, async () => {
    const ledgerSum = await prisma.pointLedger.aggregate({
      _sum: { changeAmount: true },
      where: { userId }, // tenantId 由租户扩展强制注入
    });
    const expected = ledgerSum._sum.changeAmount ?? 0;
    const redisBalance = Number(await redis.get(key));

    if (redisBalance !== expected) {
      // 不一致：以流水为准修复 Redis，并记录告警
      logger.warn(
        { tenantId: tenantIdStr, userId: userIdStr, redisBalance, expected },
        '积分对账不一致，已按流水修复 Redis',
      );
      await redis.set(key, expected);
    }

    // 落地余额到 MySQL
    await prisma.pointAccount.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: { tenantId, userId, balance: expected },
      update: { balance: expected },
    });
  });
}

/** 全量对账：SCAN 游标遍历所有余额 key */
export async function reconcile(): Promise<void> {
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'points:balance:*', 'COUNT', 100);
    cursor = next;
    for (const key of keys) {
      await reconcileKey(key);
    }
  } while (cursor !== '0');
}

/** 注册并启动对账定时任务（main.ts 调用） */
export async function startReconcileJob(): Promise<void> {
  const queue = new Queue(QUEUE_NAME, { connection });
  // BullMQ v6 定时任务：upsertJobScheduler（Queue.add 已不支持 repeat 选项）
  // 每 1 分钟重复执行
  await queue.upsertJobScheduler(
    'points-reconcile-scheduler',
    { every: 60_000 },
    { name: 'reconcile' },
  );

  new Worker(
    QUEUE_NAME,
    async () => {
      await reconcile();
    },
    { connection },
  );

  logger.info('积分对账任务已注册（每 60 秒）');
}
