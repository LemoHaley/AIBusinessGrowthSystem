/**
 * Redis 客户端（ioredis）
 * 用途：积分热点账本（Lua 原子扣减）、幂等锁、限流、refresh token 存储
 */
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export const redis = new Redis(env.REDIS_URL, {
  // 命令失败快速抛错，交给业务层处理
  maxRetriesPerRequest: 2,
});

redis.on('error', (err) => {
  logger.error({ err: err.message }, 'Redis 连接异常');
});

redis.on('connect', () => {
  logger.info('Redis 已连接');
});
