/**
 * 全局错误处理（plan.md 第 1.3 节统一响应与错误码）
 * 业务错误（ApiError）按携带的错误码返回；zod 校验失败返回 40004；
 * 其余未知错误统一 50000 并记录堆栈日志。
 */
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODES } from '@artedu/shared';
import { logger } from '../common/logger.js';
import { ApiError } from '../common/response.js';

/** 404：未匹配路由统一返回业务错误码 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: ERROR_CODES.NOT_FOUND, message: '资源不存在', data: null });
}

/** 错误兜底中间件：必须保持 4 参数签名，Express 才能识别为错误处理器 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.httpStatus).json({ code: err.code, message: err.message, data: null });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ code: ERROR_CODES.PARAM_INVALID, message: '参数校验失败', data: null });
    return;
  }
  // 未知异常：记录堆栈，对外隐藏细节
  logger.error({ err }, '未处理异常');
  res.status(500).json({ code: ERROR_CODES.INTERNAL, message: '服务器内部错误', data: null });
}
