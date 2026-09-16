# 阶段 10：联调与部署

| 属性         | 值                                                           |
| :----------- | :----------------------------------------------------------- |
| 状态         | 未开始                                                       |
| 前置依赖     | 阶段 8、9                                                    |
| 对应 plan.md | 第 5 周任务 5.1-5.4、第 6 周任务 6.1-6.5（第 10 节部署方案） |
| 提交节点     | `chore: 阶段10 部署上线`                                     |

## 目标

三端联调、安全排查、性能压测、Docker 化部署上线，交付真实客户试用。

## 任务分解

### 10.1 端到端联调（任务 5.1）

- 模拟完整场景：机构配置 → 建班级/学员 → 老师生成点评（Web）→ 家长小程序查看
- 重点排查：
  - 多租户数据串号（租户扩展是否全覆盖）
  - 权限越界（尤其第 5.6 节家长行级过滤）
  - 积分对账一致性

### 10.2 调优与压测（任务 5.2-5.4）

- Prompt 行业化调优：舞蹈/艺术教培语气、结构（优点/改进建议/鼓励）
- RAG 调优：chunk size、topK，验证基于机构知识库准确回答
- 性能：100+ 并发 SSE 流式测试；积分扣减并发测试；数据库慢查询优化

### 10.3 Docker 化（任务 6.1，第 10 节方案）

- Dockerfile：server（Node 构建 + 运行）、admin（nginx 托管静态资源）
- docker-compose.yml：
  - mysql / redis：healthcheck（mysqladmin ping / redis-cli ping）+ restart: unless-stopped
  - server：`depends_on: condition: service_healthy`
- Nginx：HTTPS 终端 + SSE 透传（`proxy_buffering off`、`proxy_read_timeout 300s`、`proxy_http_version 1.1`）
- `.env` 注意：容器网络内 `DB_HOST=mysql`、`REDIS_URL=redis://redis:6379`

### 10.4 生产部署与交付（任务 6.2-6.5）

- 域名、SSL 证书配置
- 小程序提交审核
- 种子客户：创建租户账号、导入基础数据（学员/老师/班级）
- 《机构管理员操作手册》《老师快速上手指南》
- 邀请 1-2 家真实机构试用，收集反馈修复 BUG

## 验证清单

- [ ] `docker compose up` 一键启动全部服务（依赖健康就绪）
- [ ] HTTPS 下 SSE 流式正常（无缓冲卡顿）
- [ ] 完整业务闭环在三个端跑通
- [ ] 小程序审核通过
- [ ] 真实客户试用反馈闭环
