/**
 * 统一响应封装（plan.md 第 1.3 节）
 * 成功 { code: 0, message: 'ok', data }；失败由全局 errorHandler 转换
 */
import { ERROR_CODES } from '@artedu/shared';

/**
 * 业务错误：携带错误码与 HTTP 状态
 * service/controller 中抛出，由全局 errorHandler 统一转换为响应体
 */
export class ApiError extends Error {
  constructor(
    /** 业务错误码（ERROR_CODES 之一） */
    public readonly code: number,
    message: string,
    /** HTTP 状态码 */
    public readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 递归转换 BigInt 为 Number（JSON.stringify 不支持 BigInt）
 * 自增 ID 在安全整数范围内（2^53 远超实际数据量），转换无损
 */
function serializeBigInt<T>(value: T): T {
  if (typeof value === 'bigint') return Number(value) as T;
  if (Array.isArray(value)) return value.map((item) => serializeBigInt(item)) as T;
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = serializeBigInt(item);
    }
    return result as T;
  }
  return value;
}

/** 成功响应组装（自动转换 BigInt，保证 JSON 可序列化） */
export function ok<T>(data: T) {
  return { code: ERROR_CODES.OK, message: 'ok', data: serializeBigInt(data) };
}
