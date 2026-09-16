/**
 * 认证模块路由（plan.md 第 8.1 节）
 * 登录/刷新为公开接口；登出/当前用户需登录
 */
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { authController } from './auth.controller.js';

export const authRoutes: Router = Router();

// 公开：后台账号密码登录
authRoutes.post('/admin-login', asyncHandler(authController.adminLogin));

// 公开：小程序登录
authRoutes.post('/wx-login', asyncHandler(authController.wxLogin));

// 公开：刷新 token（携带 refresh token）
authRoutes.post('/refresh', asyncHandler(authController.refresh));

// 需登录：登出
authRoutes.post('/logout', requireAuth, asyncHandler(authController.logout));

// 需登录：当前用户信息
authRoutes.get('/me', requireAuth, asyncHandler(authController.me));
