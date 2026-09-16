/**
 * 班级服务（plan.md 第 8.2 节）
 * Class 在租户扩展白名单内；schema 未定义 Class->User 关联，老师名由上层组装
 */
import { prisma } from '../../common/prisma.js';
import { getTenantContext } from '../../common/tenant-context.js';

/** 班级列表（含在册学员数统计；按创建时间倒序）
 *  schema 未定义 Class->Student 关联，include 不可用，学员数用 groupBy 手动统计 */
async function listClasses() {
  const [classes, counts] = await Promise.all([
    prisma.class.findMany({ where: { status: 1 }, orderBy: { createdAt: 'desc' } }),
    prisma.student.groupBy({
      by: ['classId'],
      _count: { _all: true },
      where: { status: 1 },
    }),
  ]);
  const countMap = new Map(
    counts.filter((c) => c.classId !== null).map((c) => [c.classId!.toString(), c._count._all]),
  );
  return classes.map((c) => ({ ...c, studentCount: countMap.get(c.id.toString()) ?? 0 }));
}

/** 创建班级 */
async function createClass(input: { name: string; teacherId?: bigint }) {
  const { tenantId } = getTenantContext();
  return await prisma.class.create({
    data: {
      tenantId, // 显式传入（值与上下文一致，租户扩展会强制覆盖）
      name: input.name,
      teacherId: input.teacherId,
    },
  });
}

/** 更新班级（name / teacherId / status；teacherId 传 null 表示清空负责老师） */
async function updateClass(input: {
  id: bigint;
  name?: string;
  teacherId?: bigint | null;
  status?: number;
}) {
  const data: { name?: string; teacherId?: bigint | null; status?: number } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.teacherId !== undefined) data.teacherId = input.teacherId;
  if (input.status !== undefined) data.status = input.status;
  return await prisma.class.update({ where: { id: input.id }, data });
}

/** 删除班级（软删：status=0，schema 无 deleted_at 字段，复用既有状态语义） */
async function deleteClass(id: bigint) {
  return await prisma.class.update({ where: { id }, data: { status: 0 } });
}

export const classService = { listClasses, createClass, updateClass, deleteClass };
