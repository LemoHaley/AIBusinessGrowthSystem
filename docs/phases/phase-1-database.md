# 阶段 1：数据层建模

| 属性         | 值                                     |
| :----------- | :------------------------------------- |
| 状态         | 未开始                                 |
| 前置依赖     | 阶段 0                                 |
| 对应 plan.md | 任务 1.3（第 4 节 DDL）                |
| 提交节点     | `feat: 阶段1 prisma数据建模与种子数据` |

## 目标

将 plan.md 第 4 节的 11 张表 DDL 转换为 Prisma schema，在本地 MySQL 建表并灌入种子数据。这是全部后端代码的地基。

## 前置条件

- 本地 MySQL 8.0 可用
- 连接参数写入 `apps/server/.env`（已被 .gitignore 排除，不入库）

## 任务分解

### 1.1 安装 Prisma 并初始化

- `pnpm --filter @artedu/server add -D prisma` + `add @prisma/client`
- `npx prisma init`：生成 `prisma/schema.prisma` 与 `.env` 模板
- datasource 配置 mysql，generator 配置 client

### 1.2 编写 schema.prisma（11 张表）

| 表             | 说明                 | 关键约束                                                                                     |
| :------------- | :------------------- | :------------------------------------------------------------------------------------------- |
| tenants        | 租户（机构）         | expire_at 服务到期管理                                                                       |
| users          | 用户                 | uk (tenant_id, openid)；role: admin/teacher/parent                                           |
| classes        | 班级                 | idx (tenant_id)                                                                              |
| students       | 学员                 | parent_user_id 关联家长；idx (parent_user_id)                                                |
| point_accounts | 积分账户             | uk (tenant_id, user_id)；无 frozen 字段（二期）                                              |
| point_ledger   | 积分流水（只增不改） | uk_biz (tenant_id, biz_id, change_type) 幂等最后防线；change_type: recharge/consume/rollback |
| point_prices   | 计费单价             | tenant_id=0 表示全局默认（不用 NULL：MySQL 唯一索引对 NULL 不去重）                          |
| agent_configs  | Agent 配置           | tenant_id=0 同上；provider: coze/dify/openai                                                 |
| ai_logs        | AI 调用日志          | idx_tenant_time + idx_tenant_agent_time（看板聚合用）                                        |
| knowledge_docs | RAG 文档             | document_id 存第三方返回 ID                                                                  |
| ai_reports     | AI 报告/点评         | idx (tenant_id, student_id)                                                                  |

### 1.3 执行迁移

- `npx prisma migrate dev --name init`

### 1.4 种子脚本（prisma/seed.ts）

- 默认租户（演示机构）
- admin 账号（密码 bcrypt 加密）
- 默认计费单价三条：report / copywriting / chat（tenant_id=0）
- 默认 Agent 配置（provider=coze，读 COZE_BOT_ID）
- package.json 配置 `prisma.seed` 执行入口

## 验证清单

- [ ] migrate 无报错，11 张表生成（SHOW TABLES）
- [ ] seed 后可查到：默认租户 / admin / 三条单价 / Agent 配置
- [ ] point_prices 与 agent_configs 全局行 tenant_id = 0
- [ ] point_ledger 的 uk_biz 唯一索引存在（幂等防线）
