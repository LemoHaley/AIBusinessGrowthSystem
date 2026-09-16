/**
 * 班级与学员模块路由（plan.md 第 8.2 节）
 * 列表 teacher 可见；增改删仅 admin（写操作全 POST）
 * 挂载：/api/class -> classRoutes，/api/student -> studentRoutes
 */
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireRole } from '../../middleware/rbac.js';
import { classController, studentController } from './student.controller.js';

export const classRoutes: Router = Router();
export const studentRoutes: Router = Router();

// ---------- 班级 ----------
classRoutes.get('/list', requireRole('teacher'), asyncHandler(classController.list));
classRoutes.post('/create', requireRole('admin'), asyncHandler(classController.create));
classRoutes.post('/update', requireRole('admin'), asyncHandler(classController.update));
classRoutes.post('/delete', requireRole('admin'), asyncHandler(classController.remove));

// ---------- 学员 ----------
studentRoutes.get('/list', requireRole('teacher'), asyncHandler(studentController.list));
studentRoutes.post('/create', requireRole('admin'), asyncHandler(studentController.create));
studentRoutes.post('/update', requireRole('admin'), asyncHandler(studentController.update));
studentRoutes.post('/delete', requireRole('admin'), asyncHandler(studentController.remove));
