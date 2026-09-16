# 阶段 6：业务闭环

| 属性         | 值                                     |
| :----------- | :------------------------------------- |
| 状态         | 未开始                                 |
| 前置依赖     | 阶段 5                                 |
| 对应 plan.md | 第 8.2、8.4 节接口 + 第 5.6 节数据权限 |
| 提交节点     | `feat: 阶段6 业务模块与报告闭环`       |

## 目标

机构/用户/班级/学员 CRUD + 报告模块（含家长行级过滤）+ AI 报告事务闭环 + 数据看板。本阶段完成后，后端 API 全部就绪。

## 任务分解

### 6.1 机构与基础数据接口（第 8.2 节，全部写操作 POST）

| Method                                                          | Path                               | 角色 |
| :-------------------------------------------------------------- | :--------------------------------- | :--- |
| GET /api/tenant/info；POST /api/tenant/update                   | teacher / admin                    |
| GET /api/user/list；POST /api/user/create、update、delete       | teacher / admin                    |
| GET /api/class/list；POST /api/class/create、update、delete     | teacher / admin                    |
| GET /api/student/list；POST /api/student/create、update、delete | teacher / admin（delete 为 admin） |

- controller 层 zod 校验；service 层走 Prisma 租户扩展（tenantId 自动注入）
- student 创建时关联 parent_user_id（家长绑定）

### 6.2 报告模块（第 8.4 节 + 第 5.6 节行级过滤）

- `GET /api/report/list`：报告列表（parent 只能看自己孩子的）
- `GET /api/report/detail`：报告详情
- **核心安全规则**：`ctx.role === 'parent'` 时强制 `where.student = { parentUserId: ctx.userId }`
  - 防止家长 A 传家长 B 的 studentId 水平越权（RBAC 管不到行级，必须在 service 强制过滤）
- teacher / admin 可看本租户全量

### 6.3 AI 报告事务闭环（第 6.4 节）

- 扣积分（阶段 5 已实现）→ AI 生成 → **事务写入三表**：
  - point_ledger（consume 流水）
  - ai_logs（调用记录）
  - ai_reports（报告内容，status=1 已完成）
- 失败路径：rollbackPoints + ai_reports status=2 失败记录

### 6.4 数据看板

- `GET /api/dashboard/summary`：AI 调用次数、积分消耗趋势、活跃学员数
- 聚合查询走 ai_logs 的 idx_tenant_agent_time 复合索引

## 验证清单

- [ ] 一次报告生成：三表各新增一条记录，数值一致（cost_points 对齐）
- [ ] 家长 A 用家长 B 的 studentId 查询：返回空，不泄露数据
- [ ] parent 角色 token 只能调 8.4 节接口，调 8.2 接口返回 40003
- [ ] 看板聚合接口返回趋势数据
