# 阶段 4：积分核心

| 属性         | 值                            |
| :----------- | :---------------------------- |
| 状态         | 未开始                        |
| 前置依赖     | 阶段 2                        |
| 对应 plan.md | 任务 2.3、2.4、2.5（第 7 节） |
| 前置凭证     | 本地 Redis 即可，无外部依赖   |
| 提交节点     | `feat: 阶段4 积分账本核心`    |

## 目标

积分账本核心闭环：Lua 原子扣减（防超发）、余额缓存预热（防误判 0）、失败回滚、定时对账、充值与计价接口。本阶段全部本地可验证，不依赖 AI 服务。

## 任务分解

### 4.1 Lua 脚本 `apps/server/scripts/lua/deduct_points.lua`（第 7.2 节）

- KEYS[1] = `points:balance:{tenantId}:{userId}`，KEYS[2] = `points:lock:{bizId}`
- 逻辑：EXISTS 幂等锁（返回 -2 重复）→ GET 余额校验（返回 -1 不足）→ DECRBY + SET lock EX 300
- 返回扣减后余额

### 4.2 points.service.ts（第 7.3 节）

- `ensureBalanceLoaded(tenantId, userId)`：余额缓存预热
  - key 不存在时从 point_accounts 加载，`SET NX` 写入（防覆盖并发充值）
  - 必要性：对账任务只遍历已存在的 key，发现不了"丢失的 key"
- `deductPoints(params)`：先预热再 `redis.eval` 执行 Lua
- `rollbackPoints(params)`（第 7.4 节）：Redis INCRBY 回滚 + 写 rollback 反向流水（bizId = `rollback:{原bizId}`，不修改原流水）

### 4.3 BullMQ 对账任务 `jobs/reconcile.job.ts`（第 7.5 节，每 1 分钟）

- `SCAN MATCH points:balance:*` 游标遍历（禁止 KEYS）
- 以 point_ledger 流水聚合为准：不一致时修复 Redis + 记告警日志
- upsert point_accounts 落地余额

### 4.4 积分接口（第 8.5 节）

| Method | Path                      | 说明                                 | 角色    |
| :----- | :------------------------ | :----------------------------------- | :------ |
| GET    | /api/points/balance       | 查询机构积分余额                     | teacher |
| POST   | /api/points/recharge      | 充值（Redis INCRBY + recharge 流水） | admin   |
| GET    | /api/points/ledger        | 流水查询（分页）                     | teacher |
| GET    | /api/points/prices        | 计费单价查询（全局 + 租户自定义）    | teacher |
| POST   | /api/points/prices/update | 更新计费单价                         | admin   |

## 验证清单

- [ ] 模拟 100 并发同额扣减：终值 = 初值 - 100 × 单价，无超发
- [ ] 同 bizId 重复请求：返回 40902（幂等锁生效）
- [ ] 余额不足：返回 40901
- [ ] 手动删除 Redis 余额 key 后扣减：预热生效，不误判为 0
- [ ] AI 场景模拟（先扣后回滚）：rollback 流水生成，余额恢复
- [ ] 对账任务运行后 MySQL point_accounts 与 Redis 一致
