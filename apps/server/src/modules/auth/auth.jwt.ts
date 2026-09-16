/**
 * JWT 工具（plan.md 第 5.5 节认证方案）
 * access 2h + refresh 7d：refresh 存 Redis（登出即删，支持强制下线）
 * payload 携带 type 声明，防止 access 与 refresh 混用
 */
import jwt from 'jsonwebtoken';
import type { Role } from '@artedu/shared';
import { env } from '../../config/env.js';
import { redis } from '../../common/redis.js';

/** access token 有效期 */
const ACCESS_TTL = '2h' as const;
/** refresh token 有效期（秒）：7 天 */
const REFRESH_TTL_SECONDS = 7 * 24 * 3600;

/** access token payload */
export interface AccessTokenPayload {
  userId: number;
  tenantId: number;
  role: Role;
  type: 'access';
}

/** refresh token payload：携带 tenantId/role 以便刷新时无需查库即可重新签发 */
export interface RefreshTokenPayload {
  userId: number;
  tenantId: number;
  role: Role;
  type: 'refresh';
}

/** 签发的 token 对 */
export interface TokenPair {
  access: string;
  refresh: string;
}

/**
 * 签发 token 对：access 2h；refresh 7d 并写入 Redis
 * 多次签发会覆盖 Redis 中的旧 refresh（旧 refresh 自动失效）
 */
export async function issueTokens(
  userId: number,
  tenantId: number,
  role: Role,
): Promise<TokenPair> {
  const access = jwt.sign({ userId, tenantId, role, type: 'access' }, env.JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  });
  const refresh = jwt.sign({ userId, tenantId, role, type: 'refresh' }, env.JWT_SECRET, {
    expiresIn: REFRESH_TTL_SECONDS,
  });
  await redis.set(`auth:refresh:${userId}`, refresh, 'EX', REFRESH_TTL_SECONDS);
  return { access, refresh };
}

/**
 * 验证 access token（签名、过期、类型三重校验）
 * @throws 签名无效/已过期/type 非 access 时抛出异常
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === 'string' || payload.type !== 'access') {
    throw new Error('INVALID_TOKEN_TYPE');
  }
  return payload as AccessTokenPayload;
}

/**
 * 验证 refresh token（签名 + type）
 * @throws 签名无效/已过期/type 非 refresh 时抛出异常
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === 'string' || payload.type !== 'refresh') {
    throw new Error('INVALID_TOKEN_TYPE');
  }
  return payload as RefreshTokenPayload;
}

/** 吊销 refresh token（登出 / 重新签发旧值失效） */
export async function revokeRefreshToken(userId: number): Promise<void> {
  await redis.del(`auth:refresh:${userId}`);
}

/** 校验 refresh 与 Redis 存储值一致（不一致说明已吊销或被替换） */
export async function isRefreshTokenMatched(userId: number, token: string): Promise<boolean> {
  const stored = await redis.get(`auth:refresh:${userId}`);
  return stored === token;
}
