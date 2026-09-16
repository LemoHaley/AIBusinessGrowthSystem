# 阶段 3：鉴权模块

| 属性         | 值                           |
| :----------- | :--------------------------- |
| 状态         | 未开始                       |
| 前置依赖     | 阶段 2                       |
| 对应 plan.md | 任务 1.5（第 5.4、5.5 节）   |
| 提交节点     | `feat: 阶段3 认证鉴权与RBAC` |

## 目标

双端登录（小程序微信 + 后台账号密码）、token 签发/刷新/吊销、RBAC 角色守卫。

## 任务分解

### 3.1 auth.jwt.ts（第 5.5 节代码）

- `issueTokens(userId, tenantId, role)`
  - access：2h，payload 含 `{ userId, tenantId, role, type: 'access' }`
  - refresh：7d，payload 含 `{ userId, type: 'refresh' }`（type 声明防 access/refresh 混用）
  - refresh 同步写 Redis `auth:refresh:{userId}`，EX 7 天（登出即删，支持强制下线）
- `verifyAccessToken(token)`：校验签名 + type，失败抛统一错误

### 3.2 小程序登录 `POST /api/auth/wx-login`

- `wx.login` 的 code → 后端调 `code2session`（WX_APPID / WX_SECRET）换 openid
- 查/建 user（role=parent，uk_tenant_openid 幂等）
- 签发 token 对

### 3.3 后台登录 `POST /api/auth/admin-login`

- 手机号/账号 + 密码 → bcrypt verify
- 仅允许 admin / teacher 角色登录
- 签发 token 对

### 3.4 刷新与登出

- `POST /api/auth/refresh`：校验 refresh 有效**且与 Redis 存储值一致**（不一致即已吊销或被替换），通过后重新 `issueTokens`
- `POST /api/auth/logout`：删除 Redis key，实现吊销
- `GET /api/auth/me`：返回当前用户信息

### 3.5 RBAC 守卫（第 5.4 节）

- `requireRole(min)`：角色等级 admin(3) > teacher(2) > parent(1)
- 未登录返回 40001；等级不足返回 40003
- 挂载到路由级（第 8 节各表的角色列）

## 验证清单

- [ ] admin-login 返回 access + refresh
- [ ] `/api/auth/me`：带 token 正常；错 token 返回 40001
- [ ] parent 角色访问 teacher 级接口返回 40003
- [ ] logout 后旧 refresh 调 /refresh 失败
- [ ] Redis 中可查到 `auth:refresh:{userId}`
