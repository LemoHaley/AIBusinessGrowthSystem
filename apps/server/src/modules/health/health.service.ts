/**
 * 健康检查 service：探测 MySQL / Redis 连通性
 */
import { prisma } from '../../common/prisma.js';
import { redis } from '../../common/redis.js';

export const healthService = {
  async check() {
    const [db, cache] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => 'up' as const).catch(() => 'down' as const),
      redis
        .ping()
        .then(() => 'up' as const)
        .catch(() => 'down' as const),
    ]);
    return {
      status: db === 'up' && cache === 'up' ? 'ok' : 'degraded',
      db,
      cache,
      time: new Date().toISOString(),
    };
  },
};
