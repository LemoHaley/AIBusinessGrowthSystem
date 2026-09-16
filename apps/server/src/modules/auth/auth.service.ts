/**
 * 认证模块 service（plan.md 第 5.5 节 / 第 8.1 节）
 * 双端登录（小程序微信 + 后台账号密码）、刷新、登出、当前用户信息
 */
import bcrypt from 'bcryptjs';
import { ERROR_CODES } from '@artedu/shared';
import { prisma } from '../../common/prisma.js';
import { ApiError } from '../../common/response.js';
import { runWithTenantContext } from '../../common/tenant-context.js';
import { env } from '../../config/env.js';
import {
  issueTokens,
  isRefreshTokenMatched,
  revokeRefreshToken,
  verifyRefreshToken,
} from './auth.jwt.js';

/** 登录前无请求上下文：显式注入临时上下文执行租户表查询（租户扩展强制隔离） */
function runInLoginContext<T>(tenantId: bigint, fn: () => Promise<T>): Promise<T> {
  return runWithTenantContext({ tenantId, userId: 0n, role: 'parent' }, fn);
}

export const authService = {
  /** 后台账号密码登录（仅 admin/teacher；家长走小程序） */
  async adminLogin(input: { phone: string; password: string; tenantId: number }) {
    const tenantId = BigInt(input.tenantId);
    const user = await runInLoginContext(tenantId, async () => {
      return await prisma.user.findFirst({ where: { phone: input.phone } });
    });

    // 账号不存在与密码错误返回同一文案，避免账号枚举
    if (!user || !user.password) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, '账号或密码错误', 401);
    }
    const matched = await bcrypt.compare(input.password, user.password);
    if (!matched) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, '账号或密码错误', 401);
    }
    if (user.role === 'parent') {
      throw new ApiError(ERROR_CODES.FORBIDDEN, '家长账号请使用小程序登录', 403);
    }
    if (user.status !== 1) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, '账号已禁用', 403);
    }

    const tokens = await issueTokens(Number(user.id), Number(user.tenantId), user.role);
    return {
      ...tokens,
      user: {
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        role: user.role,
      },
    };
  },

  /** 小程序登录：code 换 openid，查/建 user（role=parent），签发 token 对 */
  async wxLogin(input: { code: string; tenantId: number }) {
    const openid = await code2session(input.code);
    const tenantId = BigInt(input.tenantId);

    // upsert 幂等：uk_tenant_openid 唯一键，存在则复用（openid 不更新）
    const user = await runInLoginContext(tenantId, async () => {
      return await prisma.user.upsert({
        where: { tenantId_openid: { tenantId, openid } },
        update: {},
        // tenantId 类型必填；租户扩展会强制覆盖为上下文值（此处值一致）
        create: { openid, role: 'parent', tenantId },
      });
    });
    if (user.status !== 1) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, '账号已禁用', 403);
    }

    const tokens = await issueTokens(Number(user.id), Number(user.tenantId), user.role);
    return {
      ...tokens,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
      },
    };
  },

  /** 刷新 token：校验 refresh 有效且与 Redis 存储值一致（不一致即已吊销或被替换） */
  async refresh(input: { refreshToken: string }) {
    const payload = verifyRefreshToken(input.refreshToken); // 无效抛错 -> 40001
    const matched = await isRefreshTokenMatched(payload.userId, input.refreshToken);
    if (!matched) {
      throw new ApiError(ERROR_CODES.UNAUTHORIZED, '登录状态已失效，请重新登录', 401);
    }
    return await issueTokens(payload.userId, payload.tenantId, payload.role);
  },

  /** 登出：吊销 Redis 中的 refresh token */
  async logout(userId: bigint) {
    await revokeRefreshToken(Number(userId));
  },

  /** 当前用户信息（上下文内查询，租户扩展自动过滤） */
  async me(userId: bigint) {
    const user = await prisma.user.findFirst({ where: { id: userId } });
    if (!user) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, '用户不存在', 404);
    }
    return {
      id: user.id,
      nickname: user.nickname,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      tenantId: user.tenantId,
    };
  },
};

/** 调微信 code2session 接口，用 js_code 换 openid */
async function code2session(code: string): Promise<string> {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.WX_APPID}&secret=${env.WX_SECRET}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  const res = await fetch(url);
  const data = (await res.json()) as { openid?: string; errcode?: number; errmsg?: string };
  if (!data.openid) {
    throw new ApiError(
      ERROR_CODES.PARAM_INVALID,
      `微信登录失败: ${data.errmsg || 'code 无效'}`,
      400,
    );
  }
  return data.openid;
}
