/**
 * SSE 响应工具（plan.md 阶段 5.2）
 * - 响应头：text/event-stream、no-cache、X-Accel-Buffering: no
 * - 心跳：每 15s 写 ": ping\\n\\n"，防止网关/代理因空闲断连
 * - 事件：chunk（增量）/ done（结束 + 元数据）/ error（失败信息）
 * - close 时清理心跳定时器并结束响应
 */
import type { Response } from 'express';

export interface SseSession {
  /** 发送一个命名事件，data 自动 JSON 序列化 */
  send(event: 'chunk' | 'done' | 'error', data: unknown): void;
  /** 关闭会话：停止心跳并结束响应 */
  close(): void;
}

/** 心跳间隔（毫秒） */
const HEARTBEAT_INTERVAL_MS = 15000;

/** 初始化 SSE 响应（立即刷出响应头，避免被缓冲） */
export function createSse(res: Response): SseSession {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, HEARTBEAT_INTERVAL_MS);

  // 客户端断开时停止心跳，避免句柄泄漏
  res.on('close', () => clearInterval(heartbeat));

  return {
    send(event, data) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      clearInterval(heartbeat);
      res.end();
    },
  };
}
