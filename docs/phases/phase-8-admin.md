# 阶段 8：Web 管理后台

| 属性         | 值                         |
| :----------- | :------------------------- |
| 状态         | 已完成（8.5 知识库暂缓）   |
| 前置依赖     | 阶段 6（后端接口全部就绪） |
| 对应 plan.md | 第 3 周任务 3.1-3.6        |
| 提交节点     | `feat: 阶段8 Web管理后台`  |

## 目标

机构端 Web 管理后台（Vue 3 + Element Plus），覆盖登录、基础数据管理、AI 经营助手（核心）、知识库、积分计费、看板。

## 任务分解

### 8.1 脚手架（替换占位包） — 已完成

- [x] `apps/admin` 初始化：Vite + Vue 3 + TypeScript + Element Plus + Pinia + Vue Router
- [x] axios 封装：请求自动带 Bearer token；401 自动跳登录页
- [x] 引用 `@artedu/shared` 复用类型/错误码

### 8.2 登录与布局（任务 3.1） — 已完成

- [x] 登录页：账号密码 → `/api/auth/admin-login`
- [x] 主布局：侧边栏 + 顶栏 + 面包屑
- [x] 路由守卫：未登录跳转登录页
- [x] token 过期自动 refresh

### 8.3 基础数据页面（任务 3.2） — 已完成

- [x] 机构信息配置
- [x] 老师账号管理（增删改查、角色分配）
- [x] 班级管理 + 学员档案（按班级/老师筛选，支持关联家长）

### 8.4 AI 经营助手（任务 3.3，核心） — 已完成

- [x] **AI 点评生成器**：选学员 → 输入课堂表现 → `POST /api/ai/report/generate` → 流式展示 → 人工编辑 → 保存
- [x] **AI 招生文案**：输入机构特色 → 生成 → 一键复制
- [x] **AI 对话**：fetch + ReadableStream 接收 SSE，打字机效果
- [x] **bizId 幂等**：前端生成 `bizId`（crypto.randomUUID），服务端明确回滚后重试换新单，网络中断则复用原单防重复扣费
- [x] 后端 AI 闭环：Provider 抽象 + OpenAI 兼容实现（流式/非流式）、SSE 工具、Agent 配置解析、扣分 → 调用 → 成功记 aiReport/aiLog，失败回滚 + aiLog(status=0)
- [x] report/copywriting 路由 `requireRole('teacher')`；report `POST /save` 保存编辑结果

### 8.5 知识库管理（任务 3.4） — 暂缓

> 依赖阶段 7（OSS 上传 + RAG 检索），资源未就绪，页面保留占位。

- [ ] 文档拖拽上传（进度条）
- [ ] 文档列表：状态标签（待处理/已索引/失败）

### 8.6 积分与看板（任务 3.5、3.6） — 已完成

- [x] 积分余额、消耗流水、充值操作
- [x] 计费单价配置（point_prices）
- [x] Agent 配置管理（provider/bot/Prompt 在线编辑）
- [x] 额度预警（低于阈值站内提示，AdminLayout `onMounted` 检查 `/points/balance`，低于 20 弹 `ElNotification.warning`）
- [x] ECharts 看板：调用次数、积分趋势、活跃学员

## 验证清单

- [x] 浏览器全链路：登录 → 建班级/学员 → 生成点评（流式打字机）→ 查看积分流水扣减
- [x] 401 自动跳登录；refresh 静默续期
- [x] AI 失败时提示积分已回滚（SSE error 事件 + 前端区分回滚/网络中断提示文案）
- [x] 双击生成按钮不重复扣费（bizId 幂等，Redis 锁 40902 + consume 唯一流水）
- [x] 失败重试不重复扣费：服务端已回滚→换新 bizId，网络中断→复用原 bizId

## 补充说明

- AI Provider 采用 OpenAI 兼容协议（支持 OpenAI / DeepSeek / 网关），需在 `.env` 填写真实 `OPENAI_API_KEY`，并在后台 Agent 配置中将 report/copywriting/chat 切换为 `openai`。
- 鉴权全链路冒烟已验证：充值 → 扣分 → AI 失败 → 自动回滚（余额净额不变）→ 同 bizId 重试 40902 幂等拦截。
- 8.5 知识库暂缓至阶段 7（OSS + RAG 就绪后）。
