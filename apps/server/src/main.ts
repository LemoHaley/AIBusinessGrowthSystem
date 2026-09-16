/**
 * 服务启动入口
 * 阶段 2 将挂载 Express 实例与中间件链（plan.md 第 1.2 节）
 */
import { APP_NAME } from '@artedu/shared';

console.log(`[${new Date().toISOString()}] ${APP_NAME} server bootstrap`);
