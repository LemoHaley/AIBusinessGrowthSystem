/**
 * pino 日志（plan.md 第 2 节：日志输出 stdout，由 Docker/采集器统一收集）
 */
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // 统一时间戳为 ISO 格式，便于日志系统解析
  timestamp: pino.stdTimeFunctions.isoTime,
});
