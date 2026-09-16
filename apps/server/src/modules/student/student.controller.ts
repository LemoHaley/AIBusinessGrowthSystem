/**
 * 班级与学员模块控制器
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ERROR_CODES } from '@artedu/shared';
import { ApiError, ok } from '../../common/response.js';
import { classService } from './class.service.js';
import { studentService } from './student.service.js';

const classCreateSchema = z.object({
  name: z.string().min(1).max(64),
  teacherId: z.coerce.bigint().optional(),
});
const classUpdateSchema = z.object({
  id: z.coerce.bigint(),
  name: z.string().min(1).max(64).optional(),
  teacherId: z.coerce.bigint().nullable().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});
const idSchema = z.object({ id: z.coerce.bigint() });

const studentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  classId: z.coerce.bigint().optional(),
});
const studentCreateSchema = z.object({
  name: z.string().min(1).max(64),
  classId: z.coerce.bigint().nullable().optional(),
  parentUserId: z.coerce.bigint().nullable().optional(),
  level: z.string().max(32).optional(),
});
const studentUpdateSchema = z.object({
  id: z.coerce.bigint(),
  name: z.string().min(1).max(64).optional(),
  classId: z.coerce.bigint().nullable().optional(),
  parentUserId: z.coerce.bigint().nullable().optional(),
  level: z.string().max(32).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

export const classController = {
  /** GET /api/class/list 班级列表（含学员数统计） */
  async list(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.json(ok(await classService.listClasses()));
  },
  /** POST /api/class/create */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = classCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await classService.createClass(parsed.data)));
  },
  /** POST /api/class/update */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = classUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await classService.updateClass(parsed.data)));
  },
  /** POST /api/class/delete（软删） */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = idSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await classService.deleteClass(parsed.data.id)));
  },
};

export const studentController = {
  /** GET /api/student/list 学员列表（分页、按班级过滤） */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = studentListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await studentService.listStudents(parsed.data)));
  },
  /** POST /api/student/create */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = studentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await studentService.createStudent(parsed.data)));
  },
  /** POST /api/student/update */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = studentUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await studentService.updateStudent(parsed.data)));
  },
  /** POST /api/student/delete（软删） */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    const parsed = idSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ApiError(ERROR_CODES.PARAM_INVALID, '参数校验失败', 400));
      return;
    }
    res.json(ok(await studentService.deleteStudent(parsed.data.id)));
  },
};
