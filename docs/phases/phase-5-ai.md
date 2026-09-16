# 阶段 5：AI 中台

| 属性         | 值                                |
| :----------- | :-------------------------------- |
| 状态         | 未开始                            |
| 前置依赖     | 阶段 4                            |
| 对应 plan.md | 任务 2.1、2.2（第 6 节）          |
| 前置凭证     | Coze API key + bot id             |
| 提交节点     | `feat: 阶段5 AI中台与SSE流式输出` |

## 目标

Provider 抽象（第三方可插拔）+ Coze 接入 + SSE 流式输出 + 计费闭环（扣减 → 生成 → 失败回滚）。

## 任务分解

### 5.1 Provider 抽象与 Coze 实现

- `modules/ai/providers/provider.interface.ts`：`AiProvider`（chat + chatStream）、`AiChatParams`（agentType/prompt/context/userId）、`AiResult`（content/tokens）
- `CozeProvider`（首选）：对接 Coze chat API，支持流式
- 预留 `DifyProvider` / `OpenAIProvider` 扩展位（本阶段只做 Coze）
- 读取 `agent_configs` 表按 agentType 路由 provider/bot_id（tenant_id 优先，0 为全局默认），运营可在线切换

### 5.2 SSE 封装 `modules/ai/sse.ts`（第 6.2 节）

- 响应头：`Content-Type: text/event-stream`、`Cache-Control: no-cache`、`X-Accel-Buffering: no`
- 心跳：每 15s 写 `: ping\n\n` 防中间层断连
- 数据事件 `data: { type: 'chunk', content }`；结束 `event: done`；异常 `event: error`
- finally 中清理心跳定时器并 end

### 5.3 AI 接口（第 8.3 节）

| Method | Path                         | 说明                                                      | 角色    |
| :----- | :--------------------------- | :-------------------------------------------------------- | :------ |
| POST   | /api/ai/chat                 | AI 对话，SSE 流式；`stream=false` 走非流式                | teacher |
| POST   | /api/ai/report/generate      | 生成学员点评/报告（body 含 bizId + studentId + 课堂表现） | teacher |
| POST   | /api/ai/copywriting/generate | 生成招生文案（body 含 bizId）                             | teacher |
| GET    | /api/ai/logs                 | 调用日志（分页/筛选）                                     | admin   |
| GET    | /api/ai/agents               | Agent 配置列表                                            | admin   |
| POST   | /api/ai/agents/update        | 更新配置（provider/bot/prompt）                           | admin   |

> **bizId 规则**：由前端生成（nanoid/uuid）随请求体传入，服务端不得自行生成——同一 bizId 重试只扣一次积分。

### 5.4 计费闭环（第 6.4 节时序）

1. 查 point_prices 得单价
2. `deductPoints(bizId)`（不足 40901 / 重复 40902 直接返回）
3. 调 provider（chat 或 chatStream）
4. 成功：事务写 ai_logs + ai_reports（报告类）
5. 失败：`rollbackPoints` 回滚余额 + 写 rollback 流水

## 验证清单

- [ ] `curl -N` 流式收到多个 chunk + done 事件
- [ ] `stream=false` 返回完整 JSON
- [ ] Coze key 配错时：积分自动回滚 + rollback 流水
- [ ] 重复 bizId 返回 40902，不重复扣费
- [ ] ai_logs 记录 tokens/cost_points/duration_ms
- [ ] 后台改 agent_configs 的 bot_id，无需重启即生效
