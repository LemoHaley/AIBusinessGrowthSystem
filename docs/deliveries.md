# ArtEdu AI 阶段交付记录

> 本文档记录每个已完成阶段的**实际交付内容与验证结果**，每完成一个阶段追加一节。
> 规划文档见 `docs/phases/`（`plan.md` 为设计蓝图、唯一事实来源），进度总览见 `ROADMAP.md`，HTML 版见 `docs/deliveries.html`。

---

## 阶段 0：Monorepo 骨架

| 属性   | 值                                          |
| :----- | :------------------------------------------ |
| 状态   | 已完成                                      |
| commit | `9a06bc3` chore: 阶段0 初始化 monorepo 骨架 |
| 日期   | 2026-09-16                                  |

### 交付内容

- pnpm workspace 四包结构：`apps/server`（@artedu/server）、`apps/admin`（占位，阶段 8 初始化）、`apps/miniapp`（占位，阶段 9 初始化）、`packages/shared`（@artedu/shared）
- `packages/shared`：三端共享常量与类型（APP_NAME、ERROR_CODES、ApiResponse、Role）
- `apps/server`：TypeScript 严格模式 + NodeNext ESM 骨架，最简启动入口
- 代码规范工具链：根级 ESLint 9（扁平配置 + typescript-eslint）、Prettier、Husky（pre-commit 跑 lint-staged，commit-msg 跑 commitlint Conventional Commits）
- `pnpm-workspace.yaml` allowBuilds：prisma / esbuild 等构建脚本白名单（pnpm 11 安全机制适配）

### 验证结果

- `pnpm install` 成功；`pnpm -r build` 全绿；`pnpm lint` 通过
- 首次 commit 触发 pre-commit 与 commit-msg 两个 hooks（commitlint 拦截不合格消息已实测）

---

## 阶段 1：数据层建模

| 属性   | 值                                             |
| :----- | :--------------------------------------------- |
| 状态   | 已完成                                         |
| commit | `2ba2ba3` feat: 阶段1 prisma数据建模与种子数据 |
| 日期   | 2026-09-16                                     |

### 交付内容

- `apps/server/prisma/schema.prisma`：按 plan.md 第 4 节 DDL 建 11 张表（tenants / users / classes / students / point_accounts / point_ledger / point_prices / agent_configs / ai_logs / ai_reports / knowledge_docs）
- 关键约束落地：`uk_biz (tenant_id, biz_id, change_type)` 积分幂等最后防线、`uk_tenant_openid` 微信登录幂等、`idx_tenant_role` 等复合索引；point_prices / agent_configs 支持 `tenant_id=0` 全局行
- `prisma migrate dev` 迁移文件（本地 MySQL 8.0）
- `apps/server/prisma/seed.ts`：默认租户"演示舞蹈艺术中心"、admin 账号（13800000000 / admin123）、计费单价（report=10 / copywriting=5 / chat=1）、默认 Agent 配置（Coze）

### 验证结果

- 迁移执行成功，11 张表结构符合 DDL
- seed 后可查到租户、admin、单价与 Agent 配置数据

---

## 阶段 2：后端底座

| 属性   | 值                                           |
| :----- | :------------------------------------------- |
| 状态   | 已完成                                       |
| commit | `5f4d6f7` feat: 阶段2 后端底座与多租户中间件 |
| 日期   | 2026-09-16                                   |

### 交付内容

- Express 4 + TypeScript 分层骨架：`middleware/ + modules/ + common/ + config/`，NodeNext ESM（相对导入带 `.js`）
- **Prisma 租户扩展**（`src/common/prisma.ts`）：TENANT_MODELS 白名单（user / class / student / pointAccount / pointLedger / aiLog / knowledgeDoc / aiReport）自动注入 tenantId——查询 where 展平合并强制覆盖，创建强制覆盖；**无上下文查询直接抛 TENANT_CONTEXT_MISSING**（比 plan 5.3 吞错放行更严格）
- **租户上下文**（`src/common/tenant-context.ts`）：AsyncLocalStorage + tenantMiddleware（JWT 解析注入，BigInt 转换）
- 统一响应与错误处理：`ok()`（内含递归 BigInt→Number 序列化）+ ApiError + ZodError / 未知错误三级 error-handler + asyncHandler
- 基础设施：pino / pino-http 结构化日志、zod 环境变量校验（失败即退出）、ioredis 客户端、`/api/health` 探活
- 验证脚本 `scripts/tenant-check.ts`：租户隔离绕过测试

### 验证结果

- 服务启动成功（port 3000），Redis 连接正常
- tenant-check 4 项全部 PASS：无上下文查询被拦截（TENANT_CONTEXT_MISSING）、上下文内自动过滤 tenantId、传入其他租户 id 被强制覆盖、创建自动注入 tenantId

### 关键决策

- Prisma 惰性 Promise 陷阱：`tenantStorage.run` 回调必须 `async` + `await` 查询，否则扩展执行时已脱离 AsyncLocalStorage 上下文
- BigInt 在 JWT payload / 响应层统一转换策略：schema 用 BigInt（对齐 BIGINT 列），`ok()` 递归转 Number

---

## 阶段 3：鉴权模块

| 属性   | 值                                   |
| :----- | :----------------------------------- |
| 状态   | 已完成                               |
| commit | `5405700` feat: 阶段3 认证鉴权与RBAC |
| 日期   | 2026-09-16                           |

### 交付内容

- `auth.jwt.ts`：issueTokens（access 2h + refresh 7d，payload 携带 type 声明防混用）、verifyAccessToken / verifyRefreshToken、refresh 存 Redis `auth:refresh:{userId}`（EX 7 天，登出即删）、revokeRefreshToken / isRefreshTokenMatched
- `auth.service.ts`：adminLogin（bcrypt 校验，parent 拒绝 403，账号不存在与密码错误同文案防枚举）、wxLogin（code2session + upsert uk_tenant_openid）、refresh（Redis 存储值一致性校验，防吊销后重放）、logout、me
- 登录前查询解法：`runInLoginContext` 显式注入临时租户上下文（鸡生蛋问题）
- 5 个接口：`POST /api/auth/admin-login`、`POST /api/auth/wx-login`、`POST /api/auth/refresh`、`POST /api/auth/logout`、`GET /api/auth/me`
- RBAC：requireAuth（40001）+ requireRole（admin=3 > teacher=2 > parent=1，不足 40003）

### 验证结果

- admin-login 返回 access + refresh 双 token
- `/api/auth/me` 带 token 正常；错 token 返回 40001
- logout 后旧 refresh 调 /refresh 失败（Redis 一致性校验生效）
- Redis 可查到 `auth:refresh:{userId}`，TTL 约 604791 秒（7 天）
- 错误密码返回 40001；parent 角色越权（40003）留待阶段 6 业务接口落地时验证

### 关键决策

- refresh payload 携带 tenantId / role（plan 示意仅 userId）：否则刷新时无租户上下文无法重新签发，避免每次刷新查库

---

## 阶段 4：积分核心

| 属性   | 值                                 |
| :----- | :--------------------------------- |
| 状态   | 已完成                             |
| commit | `3813465` feat: 阶段4 积分账本核心 |
| 日期   | 2026-09-16                         |

### 交付内容

| 模块     | 文件                                        | 说明                                                                                                       |
| :------- | :------------------------------------------ | :--------------------------------------------------------------------------------------------------------- |
| Lua 脚本 | `scripts/lua/deduct_points.lua`             | EXISTS 幂等锁 → GET 余额校验 → DECRBY + SET lock EX 300 原子执行                                           |
| 账本服务 | `src/modules/points/points.service.ts`      | ensureBalanceLoaded（SET NX 预热）/ deductPoints / rollbackPoints / rechargePoints / getBalance            |
| 计价服务 | `src/modules/points/price.service.ts`       | 全局默认价（tenant_id=0）+ 租户自定义价合并，租户行优先                                                    |
| 五接口   | `points.controller.ts` + `points.routes.ts` | balance / recharge / ledger / prices / prices-update（写操作全 POST）                                      |
| 定时对账 | `src/jobs/reconcile.job.ts`                 | SCAN 游标遍历 `points:balance:*`，以 point_ledger 流水聚合为准修复 Redis + upsert point_accounts，每 60 秒 |
| 验证脚本 | `scripts/points-check.ts`                   | 覆盖验证清单 6 项                                                                                          |
| 接入     | `main.ts`（对账任务）/ `app.ts`（路由挂载） | 服务启动即注册 BullMQ 对账                                                                                 |

### 验证结果（points-check.ts，7/7 PASS）

- 充值 1000：余额精确 1000
- **100 并发同额扣减：终值 = 初值 - 100 x 单价，无超发**
- 同 bizId 重复请求：返回 40902（幂等锁生效）
- 余额不足：返回 40901
- 手动删除 Redis 余额 key 后扣减：预热生效，不误判为 0（实测 899）
- AI 场景模拟（先扣后回滚）：rollback 流水 + 补记 consume 流水生成，余额恢复
- 对账任务运行后：Redis / MySQL point_accounts / 流水聚合三者一致

HTTP 接口实测：登录 admin 后 balance=0 → recharge +100 → ledger 可查 → prices 返回三条全局价 → prices/update 后租户自定义价生效（chat 1→2，isCustom=true）

### 关键决策

1. **修复 plan.md 失败路径账目缺陷**：plan 6.4 中 consume 流水仅在 AI 成功时写入，失败路径只写 rollback 正向流水（+amount）而无对应负向流水——流水聚合将比真实余额多出回滚金额，对账任务会把差额"修复"进 Redis，**每次 AI 失败都白送用户积分**（实测复现：真实余额 899 被对账修复为 949）。修复：`rollbackPoints` 回滚时先补写原扣减的 consume 流水（-amount，占住 uk_biz 幂等位，同 bizId 重试撞唯一约束被数据库拒绝），再写 rollback 反向流水，借贷相抵
2. **BullMQ v6 API 适配**：`Queue.add` 已移除 `repeat` 选项，改用 `upsertJobScheduler` 注册每 60 秒对账任务

---

## 阶段 6'：业务闭环（本地子集）

| 属性   | 值                                                               |
| :----- | :--------------------------------------------------------------- |
| 状态   | 部分完成（6.1/6.2/6.4 + ai 纯 DB 子集；6.3 AI 报告闭环待阶段 5） |
| commit | `269b2cc` feat: 阶段6' 业务模块本地子集                          |
| 日期   | 2026-09-16                                                       |

### 背景

阶段 5（Coze）/ 7（OSS）外部凭证未备，经依赖分析先行落地不依赖外部服务的本地子集：基础数据 CRUD（6.1）、报告查询（6.2）、数据看板（6.4）与 ai 模块纯 DB 接口（Agent 配置管理）；6.3 AI 报告闭环（扣积分 → AI 生成 → 三表落库）待阶段 5 完成后补齐。

### 交付内容（20 个接口，写操作全 POST）

| 模块      | 接口                                                              | 说明                                                                                                           |
| :-------- | :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| tenant    | GET /api/tenant；POST /api/tenant/update                          | 机构信息查询（teacher）/ 更新 name、logo、contact（admin）；Tenant 全局表显式 tenantId 查询                    |
| user      | GET /api/user/list；POST /api/user/create、/update、/delete       | 用户分页（role 筛选）/ 创建（bcrypt，仅 admin/teacher，家长走小程序）/ 更新 / 软删 status=0；返回排除 password |
| class     | GET /api/class/list；POST /api/class/create、/update、/delete     | 班级 CRUD；list 用 groupBy 统计每班学员数（schema 无 @relation，include 不可用）                               |
| student   | GET /api/student/list；POST /api/student/create、/update、/delete | 学员 CRUD；list 组装 className；classId/teacherId/parentUserId 支持传 null 清空关联                            |
| report    | GET /api/report/list；GET /api/report/detail                      | 报告分页（studentId 筛选）/ 详情（最低角色 parent）；parent 行级过滤                                           |
| dashboard | GET /api/dashboard/summary                                        | admin 聚合：学员数 / 班级数 / 本月报告数 / 本月积分消耗 / 近 7 日报告与消耗趋势                                |
| ai        | GET /api/ai/agents；POST /api/ai/agents/update；GET /api/ai/logs  | Agent 配置全局默认 + 租户自定义合并（isCustom 标记）/ upsert 租户行 / 调用日志分页（agentType、status 筛选）   |

### 验证结果

- 机构信息查询与更新：name / contact 修改生效
- 班级 CRUD 全流程：创建 → list 返回 studentCount=1（groupBy 统计正确）→ 更新
- 学员 CRUD：创建关联班级 → list 组装 className → 修正关联 → 更新
- 用户创建：teacher 账号创建成功，返回数据不含 password
- **parent 越权拦截（补验阶段 3 遗留项）**：parent token 调 /api/user/list、/api/student/list、/api/dashboard/summary 均返回 403 40003
- **parent 报告行级过滤**：parent token 调 /api/report/list 返回 200 空列表（无关联学员时）；传他人 studentId 查不到数据；/api/report/detail 对非本人学员返回 403
- teacher 调 /api/dashboard/summary 返回 403 40003（admin 专属）
- dashboard/summary：聚合统计与近 7 日趋势（reportTrend / consumeTrend）返回正常
- ai/agents：全局 3 行 + 租户自定义行合并，isCustom 标记正确；ai/logs 分页返回正常
- `pnpm -r build` 与 `pnpm lint` 全绿

### 关键决策

1. **软删实现**：phase-6 文档描述 deleted_at 字段与 schema 不符，遵循 schema 用既有 status=0 语义（不改动已完成的数据层）
2. **schema 无 @relation 关联**：Class/Student/AiReport 间无法 include，班级学员数用 groupBy(classId) + Map 组装，className/studentName 手动二次查询
3. **parent 行级过滤三分支**：传指定 studentId 时校验归属、否则限定其学员集合、无关联学员直接返回空，防止家长 A 传家长 B 的 studentId 水平越权（RBAC 管不到行级）
4. **PowerShell 5.1 中文编码坑**：Invoke-RestMethod 发中文 body 默认非 UTF-8 会乱码入库，必须 [System.Text.Encoding]::UTF8.GetBytes($json) + Content-Type 含 charset=utf-8

---

> 后续阶段（5-10）完成时按相同结构追加：目标 / 交付内容 / 验证结果 / 关键决策。
