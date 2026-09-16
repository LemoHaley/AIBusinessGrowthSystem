/**
 * 健康检查模块：分层骨架示例（routes -> controller -> service）
 * 同时作为 DB / Redis 连通性的探针
 */
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { healthController } from './health.controller.js';

export const healthRoutes: Router = Router();

// GET /api/health：只读探针
healthRoutes.get('/', asyncHandler(healthController.check));
