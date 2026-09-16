/**
 * 报告服务（plan.md 第 8.4 节）
 * parent 只能看自己孩子的报告（行级过滤）；teacher/admin 看全租户
 * AiReport 在租户扩展白名单内；schema 未定义 AiReport->Student 关联，学员名手动组装
 */
import { prisma } from '../../common/prisma.js';
import { ApiError } from '../../common/response.js';
import { getTenantContext } from '../../common/tenant-context.js';

/** 查询 parent 名下学员 id 列表（行级过滤依据） */
async function findOwnStudentIds(userId: bigint): Promise<bigint[]> {
  const students = await prisma.student.findMany({
    where: { parentUserId: userId },
    select: { id: true },
  });
  return students.map((s) => s.id);
}

/** 报告列表（分页，按学员过滤；parent 自动限定为自己孩子的） */
async function listReports(input: { page: number; pageSize: number; studentId?: bigint }) {
  const { userId, role } = getTenantContext();

  const where: { studentId?: bigint | { in: bigint[] } } = {};
  if (input.studentId) where.studentId = input.studentId;
  if (role === 'parent') {
    // 行级过滤：parent 只能看自己孩子的报告（指定了 studentId 时须归属自己孩子）
    const ownIds = await findOwnStudentIds(userId);
    if (input.studentId && ownIds.includes(input.studentId)) {
      where.studentId = input.studentId;
    } else if (ownIds.length > 0) {
      where.studentId = { in: ownIds };
    } else {
      return { rows: [], total: 0, page: input.page, pageSize: input.pageSize };
    }
  }

  const [rows, total] = await Promise.all([
    prisma.aiReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.aiReport.count({ where }),
  ]);

  // 组装学员名（schema 无关联，手动二次查询）
  const studentIds = [...new Set(rows.map((r) => r.studentId))];
  const students = studentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, name: true },
      })
    : [];
  const studentNameMap = new Map(students.map((s) => [s.id.toString(), s.name]));

  return {
    rows: rows.map((r) => ({
      ...r,
      studentName: studentNameMap.get(r.studentId.toString()) ?? null,
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

/** 报告详情（parent 校验归属） */
async function getReportDetail(id: bigint) {
  const { userId, role } = getTenantContext();
  const report = await prisma.aiReport.findUnique({ where: { id } });
  if (!report) {
    throw new ApiError(40404, '报告不存在', 404);
  }
  if (role === 'parent') {
    const ownIds = await findOwnStudentIds(userId);
    if (!ownIds.includes(report.studentId)) {
      throw new ApiError(403, '无权限查看该报告', 403);
    }
  }
  return report;
}

export const reportService = { listReports, getReportDetail };
