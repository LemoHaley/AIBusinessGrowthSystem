/**
 * OpenAI 兼容 Provider（plan.md 阶段 5.1）
 * 对接任意 OpenAI Chat Completions 兼容服务（OpenAI / DeepSeek / 通义 / 自建网关），
 * 服务地址、密钥、默认模型由 .env 的 OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL 配置。
 */
import { ERROR_CODES } from '@artedu/shared';
import { env } from '../../../config/env.js';
import { ApiError } from '../../../common/response.js';
import type {
  AiInvokeParams,
  AiProvider,
  AiResult,
  ProviderMessage,
} from './provider.interface.js';

/** 非流式响应中需要的字段 */
interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** 流式增量块中需要的字段 */
interface ChatCompletionChunk {
  choices?: { delta?: { content?: string | null } }[];
}

/** 拼接 chat/completions 完整地址（去掉 baseUrl 末尾斜杠避免双斜杠） */
function endpoint(): string {
  return `${env.OPENAI_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
}

/** 实际生效模型：Agent 配置的 model 优先，环境变量默认模型兜底 */
function resolveModel(params: AiInvokeParams): string {
  return params.model?.trim() || env.OPENAI_MODEL;
}

/** 未配置有效密钥时快速失败（占位值 your_openai_key 视为未配置） */
function assertConfigured(): void {
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === 'your_openai_key') {
    throw new ApiError(
      ERROR_CODES.AI_FAILED,
      '未配置 OPENAI_API_KEY，请在服务端 .env 填写 OpenAI 兼容密钥后重试',
    );
  }
}

/** 发起 chat/completions 请求（stream 由调用方指定） */
function postChat(messages: ProviderMessage[], model: string, stream: boolean): Promise<Response> {
  return fetch(endpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, stream }),
  });
}

/** 解析非 2xx 响应中的错误文案 */
async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    return data.error?.message || `AI 服务返回 HTTP ${res.status}`;
  } catch {
    return `AI 服务返回 HTTP ${res.status}`;
  }
}

export const openaiProvider: AiProvider = {
  /** 非流式调用 */
  async chat(params: AiInvokeParams): Promise<AiResult> {
    assertConfigured();
    const res = await postChat(params.messages, resolveModel(params), false);
    if (!res.ok) throw new Error(await readErrorMessage(res));

    const data = (await res.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content ?? '';
    return {
      content,
      tokensInput: data.usage?.prompt_tokens ?? null,
      tokensOutput: data.usage?.completion_tokens ?? null,
    };
  },

  /** 流式调用：逐行解析 SSE（data: {json}），抽取 delta.content 增量推送 */
  async chatStream(params: AiInvokeParams, onChunk): Promise<AiResult> {
    assertConfigured();
    const res = await postChat(params.messages, resolveModel(params), true);
    if (!res.ok) throw new Error(await readErrorMessage(res));
    if (!res.body) throw new Error('AI 服务未返回数据流');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以换行分隔，逐行消费完整行，残片留在 buffer 等待下一块
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line.startsWith('data:')) continue; // 忽略 event:/注释/空行
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const chunk = JSON.parse(payload) as ChatCompletionChunk;
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            content += delta;
            onChunk(delta);
          }
        } catch {
          // 忽略心跳或非 JSON 行
        }
      }
    }

    return { content, tokensInput: null, tokensOutput: null };
  },
};
