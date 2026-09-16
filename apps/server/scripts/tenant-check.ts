/**
 * 租户隔离绕过测试（plan.md 任务 1.4 / 阶段 2 验证清单）
 * 验证三点：
 * 1. 无上下文查询租户表必须抛 TENANT_CONTEXT_MISSING
 * 2. 携带上下文查询自动注入 tenantId 过滤（传入其他租户 id 会被强制覆盖）
 * 3. 携带上下文创建自动覆盖 tenantId
 *
 * 注意：Prisma 查询是惰性 Promise，必须在 run 回调内 await，
 * 否则扩展执行时已脱离 AsyncLocalStorage 上下文。
 *
 * 运行：pnpm --filter @artedu/server exec tsx scripts/tenant-check.ts
 */
import 'dotenv/config';
import { prisma } from '../src/common/prisma.js';
import { tenantStorage } from '../src/common/tenant-context.js';

// 测试上下文：seed 数据中租户 1 存在 admin 用户
const CTX = { tenantId: 1n, userId: 1n, role: 'admin' as const };

async function main() {
  let pass = 0;
  let fail = 0;

  // 1. 无上下文查询租户表：必须抛错（防越权查询漏网）
  try {
    await prisma.user.findMany();
    console.error('FAIL: 无上下文查询未抛错，租户隔离失效');
    fail++;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('TENANT_CONTEXT_MISSING')) {
      console.log('PASS: 无上下文查询被拦截（TENANT_CONTEXT_MISSING）');
      pass++;
    } else {
      console.error(`FAIL: 抛出了其他错误: ${msg}`);
      fail++;
    }
  }

  // 2. 携带上下文查询：自动注入 tenantId 过滤
  const users = await tenantStorage.run(CTX, async () => {
    return await prisma.user.findMany();
  });
  if (users.length > 0 && users.every((u) => u.tenantId === 1n)) {
    console.log(`PASS: 上下文内查询自动过滤 tenantId=1（共 ${users.length} 条）`);
    pass++;
  } else {
    console.error(
      `FAIL: 查询结果异常: ${JSON.stringify(users.map((u) => ({ id: u.id, tenantId: u.tenantId })))}`,
    );
    fail++;
  }

  // 3. 调用方传入其他租户 tenantId：被上下文强制覆盖
  const tampered = await tenantStorage.run(CTX, async () => {
    return await prisma.user.findMany({ where: { tenantId: 999n } });
  });
  if (tampered.length > 0 && tampered.every((u) => u.tenantId === 1n)) {
    console.log('PASS: 调用方传入的 tenantId=999 被上下文强制覆盖为 1');
    pass++;
  } else {
    console.error(`FAIL: tenantId 强制覆盖失效，返回 ${tampered.length} 条`);
    fail++;
  }

  // 4. 携带上下文创建：data 强制覆盖 tenantId
  const created = await tenantStorage.run(CTX, async () => {
    return await prisma.user.create({
      data: { nickname: 'tenant-check-temp', openid: 'tenant-check-temp' },
    });
  });
  if (created.tenantId === 1n) {
    console.log(`PASS: 创建自动注入 tenantId=1（id=${created.id}）`);
    pass++;
    // 清理测试数据
    await tenantStorage.run(CTX, async () => {
      await prisma.user.delete({ where: { id: created.id } });
    });
  } else {
    console.error(`FAIL: 创建注入 tenantId=${created.tenantId}`);
    fail++;
  }

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('脚本执行失败:', e);
  process.exit(1);
});
