/**
 * 积分模块 controller：薄层，zod 校验 + 调 service + 组装响应
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../common/prisma.js';
import { ok } from '../../common/response.js';
import { getTenantContext } from '../../common/tenant-context.js';
import { getBalance, rechargePoints } from './points.service.js';
import { priceService } from './price.service.js';

const rechargeSchema = z.object({
  userId: z.coerce.bigint().positive(), // 充值目标用户
  amount: z.coerce.number().int().positive('充值数量必须为正整数'),
  bizId: z.string().min(1, 'bizId 不能为空'), // 前端生成，幂等键
});

const priceUpdateSchema = z.object({
  agentType: z.enum(['report', 'copywriting', 'chat']),
  price: z.coerce.number().int().min(0),
});

const ledgerQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const pointsController = {
  /** GET /api/points/balance：当前用户积分余额 */
  async balance(_req: Request, res: Response): Promise<void> {
    const { userId } = getTenantContext();
    res.json(ok({ balance: await getBalance(userId) }));
  },

  /** POST /api/points/recharge：充值（admin） */
  async recharge(req: Request, res: Response): Promise<void> {
    const input = rechargeSchema.parse(req.body);
    res.json(ok({ balance: await rechargePoints(input) }));
  },

  /** GET /api/points/ledger：流水分页查询 */
  async ledger(req: Request, res: Response): Promise<void> {
    const { page, pageSize } = ledgerQuerySchema.parse(req.query);
    const { userId } = getTenantContext();

    const [total, rows] = await Promise.all([
      prisma.pointLedger.count({ where: { userId } }),
      prisma.pointLedger.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json(ok({ total, page, pageSize, rows }));
  },

  /** GET /api/points/prices：计费单价（租户自定义优先） */
  async prices(req: Request, res: Response): Promise<void> {
    const agentType = req.query.agentType ? String(req.query.agentType) : undefined;
    res.json(ok(await priceService.list(agentType)));
  },

  /** POST /api/points/prices/update：更新租户单价（admin） */
  async priceUpdate(req: Request, res: Response): Promise<void> {
    const input = priceUpdateSchema.parse(req.body);
    res.json(ok(await priceService.update(input.agentType, input.price)));
  },
};
