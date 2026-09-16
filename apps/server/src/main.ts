/**
 * 服务启动入口：创建应用并监听端口
 */
import { APP_NAME } from '@artedu/shared';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/logger.js';
import { startReconcileJob } from './jobs/reconcile.job.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`${APP_NAME} server 已启动 port=${env.PORT} NODE_ENV=${env.NODE_ENV}`);
  // 积分定时对账任务（BullMQ，每 60 秒）
  startReconcileJob().catch((err) => logger.error({ err }, '对账任务启动失败'));
});
