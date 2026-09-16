/**
 * 学员服务（plan.md 第 8.2 节）
 * Student 在租户扩展白名单内；schema 未定义 Student->Class 关联，班级名手动组装
 */
import { prisma } from '../../common/prisma.js';
import { getTenantContext } from '../../common/tenant-context.js';

/** 学员列表（分页，按班级过滤；附带所属班级名，方便后台展示） */
async function listStudents(input: { page: number; pageSize: number; classId?: bigint }) {
  const where: { classId?: bigint } = {};
  if (input.classId) where.classId = input.classId;
  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.student.count({ where }),
  ]);

  // 组装班级名（schema 无关联，手动二次查询）
  const classIds = [...new Set(rows.map((r) => r.classId).filter((v): v is bigint => v !== null))];
  const classes = classIds.length
    ? await prisma.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true },
      })
    : [];
  const classNameMap = new Map(classes.map((c) => [c.id.toString(), c.name]));

  return {
    rows: rows.map((s) => ({
      ...s,
      className: s.classId ? (classNameMap.get(s.classId.toString()) ?? null) : null,
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

/** 创建学员 */
async function createStudent(input: {
  name: string;
  classId?: bigint | null;
  parentUserId?: bigint | null;
  level?: string;
}) {
  const { tenantId } = getTenantContext();
  return await prisma.student.create({
    data: {
      tenantId, // 显式传入（值与上下文一致，租户扩展会强制覆盖）
      name: input.name,
      classId: input.classId,
      parentUserId: input.parentUserId,
      level: input.level,
    },
  });
}

/** 更新学员（name / classId / parentUserId / level / status；传 null 表示清空关联） */
async function updateStudent(input: {
  id: bigint;
  name?: string;
  classId?: bigint | null;
  parentUserId?: bigint | null;
  level?: string;
  status?: number;
}) {
  const data: {
    name?: string;
    classId?: bigint | null;
    parentUserId?: bigint | null;
    level?: string;
    status?: number;
  } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.classId !== undefined) data.classId = input.classId;
  if (input.parentUserId !== undefined) data.parentUserId = input.parentUserId;
  if (input.level !== undefined) data.level = input.level;
  if (input.status !== undefined) data.status = input.status;
  return await prisma.student.update({ where: { id: input.id }, data });
}

/** 删除学员（软删：status=0） */
async function deleteStudent(id: bigint) {
  return await prisma.student.update({ where: { id }, data: { status: 0 } });
}

export const studentService = { listStudents, createStudent, updateStudent, deleteStudent };
