/**
 * 积分核心验证脚本（plan.md 第 7 节 / 阶段 4 验证清单）
 * 覆盖 6 项：
 * 1. 100 并发同额扣减：终值 = 初值 - 100 x 单价，无超发
 * 2. 同 bizId 重复请求：返回 40902（幂等锁生效）
 * 3. 余额不足：返回 40901
 * 4. 删除 Redis 余额 key 后扣减：预热生效，不误判为 0
 * 5. AI 场景模拟（先扣后回滚）：rollback 流水生成，余额恢复
 * 6. 对账任务运行后 MySQL point_accounts 与 Redis 一致
 *
 * 说明：按 plan.md 第 6.4 节，consume 流水由 AI 成功时事务写入（阶段 5 实现），
 * 本脚本在扣减成功后手动补写 consume 流水，模拟 AI 中台的完整调用链。
 *
 * 运行：pnpm --filter @artedu/server exec tsx scripts/points-check.ts
 */
import 'dotenv/config';
import { ERROR_CODES } from '@artedu/shared';
import { prisma } from '../src/common/prisma.js';
import { redis } from '../src/common/redis.js';
import { ApiError } from '../src/common/response.js';
import { runWithTenantContext } from '../src/common/tenant-context.js';
import {
  deductPoints,
  rechargePoints,
  rollbackPoints,
} from '../src/modules/points/points.service.js';
import { reconcile } from '../src/jobs/reconcile.job.js';

// 本次运行唯一前缀（保证 bizId 跨运行不冲突，幂等锁 / uk_biz 均不受历史数据影响）
const RUN = Date.now();

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean, detail: string): void {
  if (condition) {
    console.log(`PASS: ${name} ${detail}`);
    pass++;
  } else {
    console.error(`FAIL: ${name} ${detail}`);
    fail++;
  }
}

/** 模拟 AI 成功：扣减后补写 consume 流水（plan.md 第 6.4 节，阶段 5 由 AI 中台实现） */
async function writeConsumeRow(
  tenantId: bigint,
  userId: bigint,
  amount: number,
  balanceAfter: number,
  bizId: string,
): Promise<void> {
  await prisma.pointLedger.create({
    data: {
      tenantId,
      userId,
      changeType: 'consume',
      changeAmount: -amount, // 负数减少
      balanceAfter,
      bizId,
      bizType: 'ai_chat',
      remark: '验证脚本模拟消费',
    },
  });
}

async function main() {
  const tenantId = 1n; // seed 数据中租户 1
  const user = await runWithTenantContext({ tenantId, userId: 1n, role: 'admin' }, async () => {
    return await prisma.user.create({
      data: { nickname: 'points-check-temp', openid: `points-check-${RUN}` },
    });
  });
  const userId = user.id;
  const balanceKey = `points:balance:${tenantId}:${userId}`;
  console.log(`测试用户 id=${userId} run=${RUN}\n`);

  try {
    // ---------- 前置：清空旧数据，充值 1000 ----------
    await redis.del(balanceKey);
    const initial = await runWithTenantContext({ tenantId, userId, role: 'admin' }, async () => {
      return await rechargePoints({ userId, amount: 1000, bizId: `check-${RUN}-recharge` });
    });
    check('充值', initial === 1000, `充值后余额=${initial}（期望 1000）`);

    // ---------- 1. 100 并发同额扣减（单价 1） ----------
    const UNIT = 1;
    const results = await runWithTenantContext({ tenantId, userId, role: 'admin' }, async () => {
      const tasks = Array.from({ length: 100 }, (_, i) =>
        deductPoints({ userId, amount: UNIT, bizId: `check-${RUN}-d${i}` }),
      );
      return await Promise.all(tasks);
    });
    const afterConcurrent = Number(await redis.get(balanceKey));
    check(
      '100 并发扣减无超发',
      results.length === 100 && afterConcurrent === 1000 - 100 * UNIT,
      `终值=${afterConcurrent}（期望 ${1000 - 100 * UNIT}）`,
    );

    // 补写 100 条 consume 流水（模拟 AI 全部成功）
    await runWithTenantContext({ tenantId, userId, role: 'admin' }, async () => {
      for (let i = 0; i < 100; i++) {
        await writeConsumeRow(tenantId, userId, UNIT, afterConcurrent, `check-${RUN}-d${i}`);
      }
    });

    // ---------- 2. 同 bizId 重复请求 -> 40902 ----------
    await runWithTenantContext({ tenantId, userId, role: 'admin' }, async () => {
      try {
        await deductPoints({ userId, amount: UNIT, bizId: `check-${RUN}-d0` });
        check('幂等锁', false, '重复 bizId 未被拦截');
      } catch (e) {
        check(
          '幂等锁',
          e instanceof ApiError && e.code === ERROR_CODES.DUPLICATE_REQUEST,
          `返回 code=${(e as ApiError).code}（期望 40902）`,
        );
      }
    });

    // ---------- 3. 余额不足 -> 40901 ----------
    await runWithTenantContext({ tenantId, userId, role: 'admin' }, async () => {
      try {
        await deductPoints({ userId, amount: 99999, bizId: `check-${RUN}-big` });
        check('余额不足拦截', false, '超额扣减未被拦截');
      } catch (e) {
        check(
          '余额不足拦截',
          e instanceof ApiError && e.code === ERROR_CODES.POINTS_INSUFFICIENT,
          `返回 code=${(e as ApiError).code}（期望 40901）`,
        );
      }
    });

    // ---------- 4. 删除 Redis key 后扣减：预热生效 ----------
    // 先对账一次，把当前余额落地 MySQL（预热的数据源）
    await reconcile();
    await redis.del(balanceKey);
    const afterPreheat = await runWithTenantContext(
      { tenantId, userId, role: 'admin' },
      async () => {
        return await deductPoints({ userId, amount: UNIT, bizId: `check-${RUN}-pre` });
      },
    );
    check(
      '余额预热',
      afterPreheat === afterConcurrent - UNIT,
      `删 key 后扣减余额=${afterPreheat}（期望 ${afterConcurrent - UNIT}，未误判为 0）`,
    );
    await runWithTenantContext({ tenantId, userId, role: 'admin' }, async () => {
      await writeConsumeRow(tenantId, userId, UNIT, afterPreheat, `check-${RUN}-pre`);
    });

    // ---------- 5. AI 场景：先扣后回滚 ----------
    const DEDUCT_AMOUNT = 50;
    const beforeRollback = await runWithTenantContext(
      { tenantId, userId, role: 'admin' },
      async () => {
        return await deductPoints({ userId, amount: DEDUCT_AMOUNT, bizId: `check-${RUN}-rb` });
      },
    );
    // 模拟 AI 失败：回滚
    const afterRollback = await runWithTenantContext(
      { tenantId, userId, role: 'admin' },
      async () => {
        return await rollbackPoints({
          userId,
          amount: DEDUCT_AMOUNT,
          originalBizId: `check-${RUN}-rb`,
        });
      },
    );
    const [rollbackRow, consumeRow] = await runWithTenantContext(
      { tenantId, userId, role: 'admin' },
      async () => {
        return await Promise.all([
          prisma.pointLedger.findFirst({
            where: { userId, bizId: `rollback:check-${RUN}-rb` },
          }),
          prisma.pointLedger.findFirst({
            where: { userId, bizId: `check-${RUN}-rb` },
          }),
        ]);
      },
    );
    check(
      '失败回滚',
      afterRollback === beforeRollback + DEDUCT_AMOUNT &&
        rollbackRow !== null &&
        rollbackRow.changeAmount === DEDUCT_AMOUNT &&
        consumeRow !== null &&
        consumeRow.changeAmount === -DEDUCT_AMOUNT,
      `扣减后=${beforeRollback} 回滚后=${afterRollback}，rollback 流水${
        rollbackRow ? '已生成' : '缺失'
      }，补记 consume 流水${consumeRow ? '已生成' : '缺失'}`,
    );

    // ---------- 6. 对账后 MySQL 与 Redis 一致 ----------
    // 人为破坏 Redis，验证对账能按流水聚合修复
    await redis.set(balanceKey, 12345);
    await reconcile();
    const ledgerSum = await runWithTenantContext({ tenantId, userId, role: 'admin' }, async () => {
      const agg = await prisma.pointLedger.aggregate({
        _sum: { changeAmount: true },
        where: { userId },
      });
      return agg._sum.changeAmount ?? 0;
    });
    const redisFinal = Number(await redis.get(balanceKey));
    const account = await runWithTenantContext({ tenantId, userId, role: 'admin' }, async () => {
      return await prisma.pointAccount.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
      });
    });
    check(
      '定时对账',
      redisFinal === ledgerSum && account?.balance === ledgerSum && redisFinal === afterRollback,
      `Redis=${redisFinal} MySQL=${account?.balance} 流水聚合=${ledgerSum}（三者一致且等于真实余额 ${afterRollback}）`,
    );

    console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  } finally {
    // ---------- 清理测试数据 ----------
    await runWithTenantContext({ tenantId, userId, role: 'admin' }, async () => {
      await prisma.pointLedger.deleteMany({ where: { userId } });
      await prisma.pointAccount.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    });
    await redis.del(balanceKey);
    await prisma.$disconnect();
    await redis.quit();
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('脚本执行失败:', e);
  process.exit(1);
});
