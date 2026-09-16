/**
 * 服务启动入口：创建应用并监听端口
 */
import { APP_NAME } from '@artedu/shared';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/logger.js';

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`${APP_NAME} server 已启动 port=${env.PORT} NODE_ENV=${env.NODE_ENV}`);
});
