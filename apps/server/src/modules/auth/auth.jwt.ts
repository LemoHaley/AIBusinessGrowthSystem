/**
 * JWT 工具（plan.md 第 5.5 节）
 * 阶段 2 实现 access token 验证（tenantMiddleware 依赖）；
 * 阶段 3 补充 issueTokens 签发对与 refresh 流程。
 */
import jwt from 'jsonwebtoken';
import type { Role } from '@artedu/shared';
import { env } from '../../config/env.js';

/** access token payload：type 声明防止与 refresh token 混用 */
export interface AccessTokenPayload {
  userId: number;
  tenantId: number;
  role: Role;
  type: 'access';
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
