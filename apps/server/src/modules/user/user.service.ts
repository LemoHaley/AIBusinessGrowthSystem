/**
 * 用户服务（plan.md 第 8.2 节）
 * User 在租户扩展白名单内，查询自动注入 tenantId
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../../common/prisma.js';
import { getTenantContext } from '../../common/tenant-context.js';
import type { Role } from '@artedu/shared';

/** 列表查询排除密码字段 */
const PUBLIC_FIELDS = {
  id: true,
  tenantId: true,
  openid: true,
  phone: true,
  nickname: true,
  avatar: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** 用户列表（分页，按角色筛选；不返回密码） */
async function listUsers(input: { page: number; pageSize: number; role?: Role }) {
  const where: { role?: Role } = {};
  if (input.role) where.role = input.role;
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { rows, total, page: input.page, pageSize: input.pageSize };
}

/** 创建用户（仅允许 admin/teacher，家长走小程序登录自动创建） */
async function createUser(input: {
  phone: string;
  password: string;
  nickname?: string;
  role: 'admin' | 'teacher';
}) {
  const { tenantId } = getTenantContext();
  const hashed = await bcrypt.hash(input.password, 10);
  return await prisma.user.create({
    data: {
      tenantId, // 显式传入（值与上下文一致，租户扩展会强制覆盖）
      phone: input.phone,
      password: hashed,
      nickname: input.nickname,
      role: input.role,
    },
    select: PUBLIC_FIELDS,
  });
}

/** 更新用户（昵称/手机/角色/状态/密码） */
async function updateUser(input: {
  id: bigint;
  nickname?: string;
  phone?: string;
  role?: Role;
  status?: number;
  password?: string;
}) {
  const data: {
    nickname?: string;
    phone?: string;
    role?: Role;
    status?: number;
    password?: string;
  } = {};
  if (input.nickname !== undefined) data.nickname = input.nickname;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.role !== undefined) data.role = input.role;
  if (input.status !== undefined) data.status = input.status;
  if (input.password !== undefined) data.password = await bcrypt.hash(input.password, 10);

  return await prisma.user.update({
    where: { id: input.id },
    data,
    select: PUBLIC_FIELDS,
  });
}

/** 删除用户（软删：status=0，schema 无 deleted_at 字段，复用既有状态语义） */
async function deleteUser(id: bigint) {
  return await prisma.user.update({
    where: { id },
    data: { status: 0 },
    select: PUBLIC_FIELDS,
  });
}

export const userService = { listUsers, createUser, updateUser, deleteUser };
