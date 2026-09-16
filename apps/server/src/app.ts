/**
 * Express 应用实例（plan.md 第 1.2 节请求链路）
 * 中间件链：json 解析 -> 请求日志 -> 租户上下文注入 -> 业务路由 -> 404 -> 错误兜底
 */
import express from 'express';
import type { Express } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from './common/logger.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { healthRoutes } from './modules/health/health.routes.js';

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.use(tenantMiddleware);

  // 业务路由（各阶段完成一个模块在此追加挂载）
  app.use('/api/health', healthRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
