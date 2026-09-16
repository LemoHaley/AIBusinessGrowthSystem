/**
 * 数据看板服务（plan.md 第 8.3 节：GET /api/dashboard/summary）
 * 聚合：总学员/班级数、本月报告数、本月积分消耗、近 7 日报告与积分消耗趋势
 * Student/Class/AiReport/PointLedger 均在租户扩展白名单内，自动注入 tenantId
 */
import { prisma } from '../../common/prisma.js';

/** 日期转 YYYY-MM-DD（本地时区，趋势图 x 轴） */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 生成最近 n 天（含今天）的日期 key 数组 */
function recentDays(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1 - i));
    return dayKey(d);
  });
}

/** 经营数据总览 */
async function getSummary() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

  const [
    studentCount,
    classCount,
    monthReportCount,
    monthConsumeAgg,
    recentReports,
    recentConsume,
  ] = await Promise.all([
    prisma.student.count({ where: { status: 1 } }),
    prisma.class.count({ where: { status: 1 } }),
    prisma.aiReport.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.pointLedger.aggregate({
      _sum: { changeAmount: true },
      where: { changeType: 'consume', createdAt: { gte: monthStart } },
    }),
    prisma.aiReport.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.pointLedger.findMany({
      where: { changeType: 'consume', createdAt: { gte: sevenDaysAgo } },
      select: { changeAmount: true, createdAt: true },
    }),
  ]);

  // 近 7 日趋势（JS 按天聚合，MVP 数据量下无需 SQL 分组）
  const days = recentDays(7);
  const reportMap = new Map(days.map((d) => [d, 0]));
  for (const r of recentReports) {
    const key = dayKey(r.createdAt);
    if (reportMap.has(key)) reportMap.set(key, (reportMap.get(key) ?? 0) + 1);
  }
  const consumeMap = new Map(days.map((d) => [d, 0]));
  for (const l of recentConsume) {
    const key = dayKey(l.createdAt);
    if (consumeMap.has(key))
      consumeMap.set(key, (consumeMap.get(key) ?? 0) + Math.abs(l.changeAmount));
  }

  return {
    studentCount,
    classCount,
    monthReportCount,
    // consume 流水为负数，消耗取绝对值展示
    monthPointsConsumed: Math.abs(monthConsumeAgg._sum.changeAmount ?? 0),
    reportTrend: days.map((d) => ({ date: d, count: reportMap.get(d) ?? 0 })),
    consumeTrend: days.map((d) => ({ date: d, points: consumeMap.get(d) ?? 0 })),
  };
}

export const dashboardService = { getSummary };
