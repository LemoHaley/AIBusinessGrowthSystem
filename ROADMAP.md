# ArtEdu AI 开发执行路线图（ROADMAP）

> 本文件配合 `plan.md` 使用：`plan.md` 是设计蓝图（唯一事实来源），本文件是执行清单，记录阶段划分、完成标准与进度。
> 执行纪律：按依赖链推进，每阶段结束系统必须"可运行、可验证"，并形成独立 commit；失败可整体回滚到上一个绿色节点。

## 阶段总览

| 阶段 | 名称          | 前置 | 完成标准                               | 状态   |
| :--- | :------------ | :--- | :------------------------------------- | :----- |
| 0    | Monorepo 骨架 | -    | `pnpm -r build` 全绿，hooks 生效       | 已完成 |
| 1    | 数据层建模    | 0    | migrate 建表成功，seed 数据可查        | 未开始 |
| 2    | 后端底座      | 1    | 服务启动；无租户上下文查询抛错         | 未开始 |
| 3    | 鉴权模块      | 2    | curl 登录拿 token，错 token 返回 40001 | 未开始 |
| 4    | 积分核心      | 2    | 100 并发扣减不超发，同 bizId 只扣一次  | 未开始 |
| 5    | AI 中台       | 4    | curl 收到 SSE chunk + done 事件        | 未开始 |
| 6    | 业务闭环      | 5    | 一次生成落三表记录；parent 越权被拦    | 未开始 |
| 7    | 文件 + RAG    | 5    | 文档上传后 status 变"已索引"           | 未开始 |
| 8    | Web 管理后台  | 6    | 浏览器端到端可操作                     | 未开始 |
| 9    | 微信小程序    | 6    | 开发者工具跑通全链路                   | 未开始 |
| 10   | 联调与部署    | 8、9 | `docker compose up` 一键起             | 未开始 |

> 与 plan.md 周序的两处刻意调整：积分核心（阶段 4）先于 AI 网关（阶段 5）——积分纯本地可验证，AI 依赖外部凭证；前端（阶段 8/9）压轴——等后端接口与 shared 类型稳定后动工，避免联调返工。

---

## 阶段 0：Monorepo 骨架（对应 plan.md 任务 1.1）

**目标**：建立 pnpm workspace 四包结构与代码规范工具链。

**任务**：

- [x] pnpm workspace：`pnpm-workspace.yaml`（apps/* + packages/*）
- [x] `packages/shared`：TS 包，三端共享类型/常量（可构建）
- [x] `apps/server`：TS 严格模式骨架，最简启动入口（可构建）
- [x] `apps/admin`、`apps/miniapp`：占位包（阶段 8/9 再初始化脚手架）
- [x] 根级 ESLint 9（扁平配置 + typescript-eslint）、Prettier
- [x] Husky：pre-commit 跑 lint-staged；commit-msg 跑 commitlint（Conventional Commits）

**完成标准**：`pnpm install` 成功；`pnpm -r build` 通过；`pnpm lint` 通过；首次 commit 触发两个 hooks。

**提交**：`chore: 阶段0 初始化 monorepo 骨架`

## 阶段 1：数据层建模（对应 plan.md 任务 1.3）

**任务**：

- [ ] 按第 4 节 DDL 编写 `apps/server/prisma/schema.prisma`（含 uk_biz 幂等唯一键、idx_tenant_agent_time 复合索引、point_prices/agent_configs 的 tenant_id=0 全局行）
- [ ] `prisma migrate dev` 建表（本地 MySQL）
- [ ] seed 脚本：默认租户 + admin 账号 + 默认计费单价 + 默认 Agent 配置

**完成标准**：迁移成功；seed 后能查到默认数据。
**提交**：`feat: 阶段1 prisma数据建模与种子数据`

## 阶段 2：后端底座（对应 plan.md 任务 1.2、1.4）

**任务**：

- [ ] Express + TS 分层骨架：middleware/ + modules/*/（routes → controller → service）
- [ ] 全局错误处理 + 统一响应拦截 `{ code, message, data }`
- [ ] tenantStorage（AsyncLocalStorage）+ tenantMiddleware（第 5.1/5.2 节）
- [ ] Prisma 租户扩展，自动注入 tenantId（第 5.3 节）
- [ ] pino 日志、zod 校验、ioredis 客户端接入
- [ ] 绕过测试：无上下文查询租户表必须抛错

**完成标准**：服务可启动；租户扩展强制注入生效。
**提交**：`feat: 阶段2 后端底座与多租户中间件`

## 阶段 3：鉴权模块（对应 plan.md 任务 1.5）

**任务**：

- [ ] issueTokens / verifyAccessToken（第 5.5 节代码，type 声明防混用）
- [ ] 小程序登录：code2session → 查/建 user → 签发 JWT
- [ ] 后台账号密码登录（bcrypt + JWT）
- [ ] refresh token（Redis 存储，刷新校验一致性，登出吊销）
- [ ] RBAC 守卫 requireRole（第 5.4 节）

**完成标准**：登录接口返回 token；`/api/auth/me` 正常；错 token 40001；低角色访问高权限接口 40003。
**提交**：`feat: 阶段3 认证鉴权与RBAC`

## 阶段 4：积分核心（对应 plan.md 任务 2.3-2.5）

**前置凭证**：本地 Redis 即可，无外部依赖。

**任务**：

- [ ] `deduct_points.lua`（第 7.2 节）
- [ ] deductPoints + ensureBalanceLoaded 余额预热（第 7.3 节，SET NX）
- [ ] rollbackPoints 失败回滚（第 7.4 节，反向流水）
- [ ] BullMQ 对账任务（第 7.5 节，SCAN 遍历）
- [ ] 充值接口（Redis INCRBY + recharge 流水）
- [ ] point_prices 读写接口（全局默认价 + 租户自定义价）

**完成标准**：模拟 100 并发扣减余额精确无超发；同 bizId 重复请求返回 40902；余额不足返回 40901。
**提交**：`feat: 阶段4 积分账本核心`

## 阶段 5：AI 中台（对应 plan.md 任务 2.1、2.2）

**前置凭证**：Coze API key + bot id。

**任务**：

- [ ] AiProvider 接口 + CozeProvider（chat + chatStream）
- [ ] 读 agent_configs 路由到对应 provider/bot
- [ ] SSE 封装：心跳、event: done/error、X-Accel-Buffering: no
- [ ] `POST /api/ai/chat`（stream=false 降级非流式）
- [ ] `POST /api/ai/report/generate`、`/api/ai/copywriting/generate`（请求体携带前端生成的 bizId）

**完成标准**：curl 流式收到 chunk 与 done；AI 失败自动回滚积分并写 rollback 流水。
**提交**：`feat: 阶段5 AI中台与SSE流式输出`

## 阶段 6：业务闭环（对应 plan.md 第 8.2/8.4 节接口 + 第 5.6 节）

**任务**：

- [ ] tenant/user/class/student CRUD 接口（全部写操作 POST）
- [ ] report 模块：列表/详情，parent 强制过滤 student.parentUserId（第 5.6 节）
- [ ] AI 报告闭环：扣积分 → AI 生成 → 事务写 point_ledger + ai_logs + ai_reports（第 6.4 节时序）
- [ ] dashboard/summary 聚合接口

**完成标准**：一次报告生成产出三表记录；家长 A 传家长 B 的 studentId 查不到数据。
**提交**：`feat: 阶段6 业务模块与报告闭环`

## 阶段 7：文件 + RAG（对应 plan.md 任务 2.6、2.7）

**前置凭证**：阿里云 OSS。

**任务**：

- [ ] OSS SDK + multer 上传（图片/PDF/Word）
- [ ] Coze/Dify 知识库上传 API 对接，documentId 入库
- [ ] knowledge 模块接口（upload/list/delete）

**完成标准**：文档上传后 status 从"待处理"变"已索引"。
**提交**：`feat: 阶段7 文件上传与RAG知识库`

## 阶段 8：Web 管理后台（对应 plan.md 第 3 周任务 3.1-3.6）

**任务**：

- [ ] Vite + Vue3 + Element Plus + Pinia 脚手架；axios 封装（token 自动带、401 跳登录）
- [ ] 登录页 + 主布局 + 路由守卫
- [ ] 机构/老师/班级/学员管理页
- [ ] AI 点评生成器、招生文案、AI 对话（fetch + ReadableStream 打字机）
- [ ] 知识库管理、积分与计费配置、数据看板（ECharts）

**完成标准**：浏览器完成"登录 → 建学员 → 生成点评 → 查看流水"全链路。
**提交**：`feat: 阶段8 Web管理后台`

## 阶段 9：微信小程序（对应 plan.md 第 4 周任务 4.1-4.6）

**前置凭证**：微信 appid/secret。

**任务**：

- [ ] uni-app 脚手架；request 封装（token 自动刷新）
- [ ] 登录页（wx.login → 后端换 token）
- [ ] AI 对话页：enableChunked + onChunkReceived 接收 SSE（第 6.3 节），Markdown 渲染
- [ ] 成长报告页、积分中心、个人中心

**完成标准**：微信开发者工具跑通"登录 → AI 对话 → 查看孩子报告"。
**提交**：`feat: 阶段9 微信小程序`

## 阶段 10：联调与部署（对应 plan.md 第 5/6 周任务）

**任务**：

- [ ] 端到端闭环测试：机构配置 → 老师生成点评 → 家长小程序查看
- [ ] 多租户串号、权限越界排查
- [ ] Prompt / RAG 调优，100 并发 SSE 与扣减压测
- [ ] Dockerfile（server/admin）+ docker-compose（含健康检查）+ Nginx SSE 透传
- [ ] 小程序提审、真实客户试用

**完成标准**：`docker compose up` 一键启动全部服务。
**提交**：`chore: 阶段10 部署上线`

---

## 执行纪律

1. **依赖顺序不可倒置**：schema 先于后端代码；鉴权先于业务；积分先于 AI 生成；后端稳定后再做前端。
2. **每阶段一个 commit**，提交信息用 Conventional Commits（中文描述，如 `feat: 阶段3 认证鉴权与RBAC`）。
3. **代码约束**（全程有效）：租户表查询必须走 Prisma 扩展；写操作全 POST；TS 严格模式；中文注释 + JSDoc；不实现多余的 fallback。
4. **外部凭证就位点**：阶段 5 前备 Coze key、阶段 7 前备 OSS、阶段 9 前备微信 appid。
5. 每完成一个阶段，更新本文件"阶段总览"的状态列。
