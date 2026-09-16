# 阶段 2：后端底座

| 属性         | 值                                        |
| :----------- | :---------------------------------------- |
| 状态         | 未开始                                    |
| 前置依赖     | 阶段 1                                    |
| 对应 plan.md | 任务 1.2、1.4（第 1.2、5.1、5.2、5.3 节） |
| 提交节点     | `feat: 阶段2 后端底座与多租户中间件`      |

## 目标

搭建 Express 分层骨架与多租户底座，核心是 **Prisma 租户扩展**——后续所有业务模块在此之上开发，租户隔离不依赖开发者自觉。

## 任务分解

### 2.1 依赖与配置加载

- 安装：express、pino、pino-http、zod、ioredis
- `src/config/env.ts`：dotenv 加载 + zod 校验（PORT / DB_* / REDIS_URL / JWT_SECRET / WX_* / COZE_*）
- 启动时校验失败立即退出并提示缺失变量

### 2.2 分层骨架（第 1.2 节约定）

```text
src/
├── config/env.ts
├── middleware/          errorHandler / tenantMiddleware（auth、rbac 阶段 3 增加）
├── modules/*/
│   ├── *.routes.ts
│   ├── *.controller.ts   薄层：zod 校验 + 调 service
│   └── *.service.ts      唯一写业务的地方
├── common/
│   ├── prisma.ts         租户扩展实例
│   ├── redis.ts
│   ├── logger.ts         pino
│   └── tenant-context.ts AsyncLocalStorage
├── app.ts                Express 实例 + 中间件链
└── main.ts               监听端口
```

### 2.3 统一响应与错误码

- 成功 `{ code: 0, message: 'ok', data }`，失败 `{ code, message, data: null }`
- 错误码常量定义进 `packages/shared`（40001/40003/40004/40404/40901/40902/50000/50901）
- 全局 errorHandler 兜底：未知错误统一 50000，日志记录堆栈

### 2.4 租户上下文（第 5.1/5.2 节）

- `tenantStorage = new AsyncLocalStorage<TenantContext>()`
- `getTenantContext()`：无上下文抛 `TENANT_CONTEXT_MISSING`（防越权查询漏网）
- tenantMiddleware：解析 JWT payload，`tenantStorage.run({ tenantId, userId, role }, next)`
- 无效/无 token 放行，由后续 requireAuth 拦截返回 40001

### 2.5 Prisma 租户扩展（第 5.3 节，核心防串号机制）

- TENANT_MODELS 白名单：users、classes、students、pointAccounts、pointLedger、aiLogs、knowledgeDocs、aiReports（不含 tenants / point_prices / agent_configs 等全局表）
- findMany/findFirst/count/update/delete 等：where 强制合并 `AND tenantId`
- create/createMany：data 强制覆盖 tenantId
- 定时任务等无上下文场景放行（靠 try-catch 捕获）

### 2.6 绕过测试（plan 任务 1.4）

- 编写临时脚本：不带上下文直接查租户表，验证抛 `TENANT_CONTEXT_MISSING`
- 带上下文查询验证自动过滤 tenantId

## 验证清单

- [ ] `pnpm dev` 启动，pino 日志正常输出
- [ ] 访问不存在路由返回统一 404 格式
- [ ] 无上下文查询租户表抛错
- [ ] 携带上下文查询自动注入 tenantId 过滤
