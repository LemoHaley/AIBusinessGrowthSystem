# ArtEdu AI 经营增长系统

面向舞蹈/艺术教培机构的多租户 AI SaaS 系统：通过 AI 辅助机构生成课后点评、成长报告、招生文案、家长沟通话术，提升续费率与招生效率。

## MVP 形态

- 微信小程序（家长/学员端）
- Web 管理后台（机构端）
- AI SaaS 中台（后端）

## 技术栈

| 层级      | 技术                                |
| :-------- | :---------------------------------- |
| 后端      | Node.js + Express 4 + TypeScript    |
| ORM       | Prisma + MySQL 8.0                  |
| 缓存/账本 | Redis 7（ioredis + Lua 原子扣减）   |
| 异步任务  | BullMQ                              |
| 管理后台  | Vue 3 + Element Plus + Pinia        |
| 小程序    | uni-app + Vue 3                     |
| AI 服务   | Coze（首选）/ Dify / OpenAI（兜底） |

## 目录结构

```
.
├── apps
│   ├── server        # 后端 API + AI 中台（Express + TS）
│   ├── admin         # Web 管理后台（阶段 8）
│   └── miniapp       # 微信小程序（阶段 9）
├── packages
│   └── shared        # 三端共享类型/常量
├── docs
│   ├── phases/       # 各阶段开发文档
│   ├── all-phases.html  # 阶段 0-10 合集浏览页
│   ├── index.html    # 阶段文档聚合浏览页
│   ├── deliveries.md # 各阶段交付记录（完成后追加）
│   └── deliveries.html # 交付记录浏览页
├── ROADMAP.md        # 开发执行路线图
└── plan.md           # 设计蓝图（唯一事实来源，位于 docs/phases/）
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建全部包
pnpm -r build

# 启动后端开发服务
pnpm --filter @artedu/server dev
```

### 环境要求

- Node.js >= 20
- pnpm >= 11（`corepack enable`）
- MySQL 8.0（本地或 Docker）
- Redis 7（阶段 2 起需要）

数据库连接配置写入 `apps/server/.env`（模板见 `apps/server/.env.example`）。

## 开发路线

项目按 11 个阶段推进，详见 [ROADMAP.md](./ROADMAP.md) 与 [docs/all-phases.html](./docs/all-phases.html)；各已完成阶段的交付内容与验证结果记录在 [docs/deliveries.md](./docs/deliveries.md)（每完成一个阶段追加一节）：

| 阶段 | 名称                                          | 状态     |
| :--- | :-------------------------------------------- | :------- |
| 0    | Monorepo 骨架                                 | 已完成   |
| 1    | 数据层建模                                    | 已完成   |
| 2    | 后端底座                                      | 已完成   |
| 3    | 鉴权模块                                      | 已完成   |
| 4    | 积分核心                                      | 已完成   |
| 5    | AI 中台                                       | 未开始   |
| 6    | 业务闭环（本地子集完成，6.3 AI 闭环待阶段 5） | 部分完成 |
| 7-10 | 文件+RAG / 管理后台 / 小程序 / 部署           | 未开始   |

## 核心设计

- **多租户隔离**：AsyncLocalStorage 租户上下文 + Prisma Client Extensions 自动注入 tenantId，禁止绕过扩展查询租户表
- **积分账本**：Redis Lua 原子扣减（防超发）+ MySQL uk_biz 唯一约束（幂等最后防线）+ 失败 rollback 反向流水
- **幂等设计**：bizId 由前端生成，Redis 幂等锁 + 数据库唯一索引双重防线
- **SSE 流式输出**：Nginx 关闭代理缓冲，小程序 enableChunked 分块接收
