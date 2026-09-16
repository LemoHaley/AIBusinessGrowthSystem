# 阶段 9：微信小程序

| 属性         | 值                                              |
| :----------- | :---------------------------------------------- |
| 状态         | 未开始                                          |
| 前置依赖     | 阶段 6（后端接口全部就绪）                      |
| 对应 plan.md | 第 4 周任务 4.1-4.6（第 6.3 节小程序 SSE 方案） |
| 前置凭证     | 微信 appid / secret（WX_APPID / WX_SECRET）     |
| 提交节点     | `feat: 阶段9 微信小程序`                        |

## 目标

家长/学员端微信小程序（uni-app + Vue 3）：登录、AI 对话（enableChunked 分块接收 SSE）、成长报告、积分中心。

## 任务分解

### 9.1 脚手架（替换占位包）

- `apps/miniapp` 初始化：uni-app + Vue 3 + Pinia
- manifest.json：appid、所需权限
- request 封装：token 自动携带、过期自动刷新

### 9.2 登录与首页（任务 4.1、4.2）

- 登录：`wx.login` 拿 code → `/api/auth/wx-login` 换 token
- 首页：机构介绍、AI 体验入口、积分余额、轮播图、快捷入口（AI 问答/成长报告/积分中心）

### 9.3 AI 对话页（任务 4.3，关键技术点）

微信小程序**不支持 EventSource**，用 `enableChunked` 分块接收（基础库 >= 2.20.1）：

```text
uni.request({ enableChunked: true, ... })
task.onChunkReceived(chunk => {
  buffer += decode(chunk)
  按 \n\n 切分，剩余留缓冲区
  跳过 : 开头的心跳行
  解析 data: { type: 'chunk', content } → 追加渲染
})
```

- 聊天界面：消息列表 + 输入框 + 发送
- 打字机效果；Markdown 渲染（towxml 或 mp-html）
- 低版本基础库降级：`stream=false` 非流式一次性返回
- 发送消息携带前端生成的 bizId

### 9.4 AI 成长报告页（任务 4.4）

- 孩子历史报告列表（后端已做 parent 行级过滤）
- 详情页图文混排（Markdown 渲染）
- 分享到微信群

### 9.5 积分中心 + 个人中心（任务 4.5、4.6）

- 积分余额 + 流水列表
- 积分商城（MVP 只做展示 + 后台核销）
- 个人信息、学员绑定、设置

## 验证清单

- [ ] 微信开发者工具：登录 → AI 对话流式打字机 → 查看孩子报告
- [ ] 心跳行不渲染为正文
- [ ] 分块跨 SSE 事件边界时缓冲正确（无丢字/乱序）
- [ ] 网络重试同一 bizId 不重复扣费
