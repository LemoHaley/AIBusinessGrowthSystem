/**
 * AI Provider 抽象（plan.md 阶段 5.1）
 * 第三方可插拔：本阶段实现 OpenAI 兼容（OpenAI/DeepSeek/自建网关均可）；
 * Coze / Dify 预留同构扩展位，凭证就绪后新增实现并在工厂中注册即可。
 */

/** 对话消息（OpenAI Chat Completions 风格） */
export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Provider 调用入参 */
export interface AiInvokeParams {
  /** 指定模型（取 agent_configs.model），为空时使用环境变量默认模型 */
  model?: string | null;
  messages: ProviderMessage[];
}

/** Provider 调用结果 */
export interface AiResult {
  content: string;
  /** 输入 token（流式拿不到时为 null） */
  tokensInput: number | null;
  /** 输出 token（流式拿不到时为 null） */
  tokensOutput: number | null;
}

/** 流式增量回调：每收到一个文本块触发一次 */
export type ChunkHandler = (delta: string) => void;

export interface AiProvider {
  /** 非流式：一次性返回完整结果 */
  chat(params: AiInvokeParams): Promise<AiResult>;
  /** 流式：通过 onChunk 逐块推送增量，resolve 时返回拼装后的完整结果 */
  chatStream(params: AiInvokeParams, onChunk: ChunkHandler): Promise<AiResult>;
}
