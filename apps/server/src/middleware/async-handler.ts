/**
 * async 路由处理器包装（Express 4 不自动捕获 async 异常）
 * controller 一律经 asyncHandler 包装，异常自动移交全局 errorHandler
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
