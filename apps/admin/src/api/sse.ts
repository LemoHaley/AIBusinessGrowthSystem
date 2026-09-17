/**
 * SSE 流式请求封装（plan.md 阶段 8.4）
 * AI 对话/生成是 POST 且响应为 text/event-stream，无法走 axios 拦截器，
 * 这里用 fetch + ReadableStream 逐块读取后端事件：
 * - event: chunk  data: { content }  文本增量（打字机）
 * - event: done   data: { content, costPoints, reportId? }  结束元数据
 * - event: error  data: { code, message }  失败（后端已回滚积分）
 * - 以 ":" 开头为心跳注释，忽略
 * 401 时复用 http.ts 的刷新单例静默续期并重放一次。
 */
import { ERROR_CODES } from '@artedu/shared';
import { refreshAccessToken } from './http';
import { getAccessToken } from './token';

/** done 事件返回的元数据 */
export interface StreamDoneMeta {
  content: string;
  costPoints: number;
  reportId?: number;
  [key: string]: unknown;
}

export interface StreamHandlers {
  onChunk: (content: string) => void;
  onDone: (meta: StreamDoneMeta) => void;
  /**
   * 失败回调
   * @param rolledBack 服务端是否已明确回滚积分：
   *   - true：收到 SSE error 事件，本次调用已结束并退款，重试应使用新 bizId
   *   - false：网络中断或结果未知，重试须复用原 bizId 以防重复扣费
   */
  onError: (code: number, message: string, rolledBack: boolean) => void;
}

/**
 * 发起流式 POST。
 * 注意：该 Promise 在流正常结束时 resolve（onDone 已在结束前回调）；
 * 业务失败通过 handlers.onError 通知，不 reject。
 */
export async function streamPost(
  url: string,
  body: unknown,
  handlers: StreamHandlers,
): Promise<void> {
  try {
    const doFetch = (token: string | null) =>
      fetch(`/api${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

    let response: Response;
    try {
      response = await doFetch(getAccessToken());
    } catch {
      // 网络层异常，服务端是否扣费未知：复用原 bizId 重试最安全
      handlers.onError(ERROR_CODES.INTERNAL, '网络异常，请重试（复用原单号，不会重复扣费）', false);
      return;
    }

    // 401：静默刷新后用新 token 重放一次
    if (response.status === 401) {
      try {
        const access = await refreshAccessToken();
        response = await doFetch(access);
      } catch {
        handlers.onError(ERROR_CODES.UNAUTHORIZED, '登录已过期，请重新登录', false);
        return;
      }
    }

    // 非流式错误响应：流式接口在此阶段尚未扣费（多为参数/鉴权问题），按未知处理复用 bizId
    if (!response.ok || !response.body) {
      let message = `请求失败（${response.status}）`;
      try {
        const data = (await response.json()) as { message?: string };
        if (data.message) message = data.message;
      } catch {
        // 非 JSON 错误体，保留默认文案
      }
      handlers.onError(response.status || ERROR_CODES.INTERNAL, message, false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 按行消费 SSE，最后一行不完整时留在 buffer 等待下一块
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line) {
          // 空行表示一个事件结束，重置事件名
          currentEvent = '';
          continue;
        }
        if (line.startsWith(':')) continue; // 心跳注释
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
          continue;
        }
        if (!line.startsWith('data:')) continue;

        const payload = line.slice(5).trim();
        if (!payload) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue; // 忽略无法解析的片段
        }

        if (currentEvent === 'error') {
          // 服务端在发送 error 前已完成积分回滚
          const error = parsed as { code?: number; message?: string };
          handlers.onError(
            error.code ?? ERROR_CODES.AI_FAILED,
            error.message ?? 'AI 调用失败',
            true,
          );
        } else if (currentEvent === 'done') {
          handlers.onDone(parsed as StreamDoneMeta);
        } else {
          const chunk = parsed as { content?: string };
          if (chunk.content) handlers.onChunk(chunk.content);
        }
      }
    }
  } catch {
    // 读取过程中断（连接中断等），服务端处理结果未知：复用原 bizId 重试最安全
    handlers.onError(ERROR_CODES.INTERNAL, '连接中断，请重试（复用原单号，不会重复扣费）', false);
  }
}
