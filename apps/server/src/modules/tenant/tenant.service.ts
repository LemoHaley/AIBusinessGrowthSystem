/**
 * 机构信息服务（plan.md 第 8.2 节）
 * Tenant 为全局表（不在租户扩展白名单），按上下文 tenantId 显式查询
 */
import { prisma } from '../../common/prisma.js';
import { ApiError } from '../../common/response.js';
import { getTenantContext } from '../../common/tenant-context.js';

/** 查询当前机构信息（机构不存在或已禁用返回 40404） */
async function getTenantInfo() {
  const { tenantId } = getTenantContext();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || tenant.status === 0) {
    throw new ApiError(40404, '机构不存在或已禁用', 404);
  }
  return tenant;
}

/** 更新机构信息（name / logo / contact） */
async function updateTenant(input: { name?: string; logo?: string; contact?: string }) {
  const { tenantId } = getTenantContext();
  const data: { name?: string; logo?: string; contact?: string } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.logo !== undefined) data.logo = input.logo;
  if (input.contact !== undefined) data.contact = input.contact;
  return await prisma.tenant.update({ where: { id: tenantId }, data });
}

export const tenantService = { getTenantInfo, updateTenant };
