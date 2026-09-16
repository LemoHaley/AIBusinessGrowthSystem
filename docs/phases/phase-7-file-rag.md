# 阶段 7：文件 + RAG 知识库

| 属性         | 值                                            |
| :----------- | :-------------------------------------------- |
| 状态         | 未开始                                        |
| 前置依赖     | 阶段 5                                        |
| 对应 plan.md | 任务 2.6、2.7（第 8.6 节）                    |
| 前置凭证     | 阿里云 OSS（ACCESS_KEY/SECRET/BUCKET/REGION） |
| 提交节点     | `feat: 阶段7 文件上传与RAG知识库`             |

## 目标

通用文件上传（multer → OSS）+ RAG 知识库对接（Coze/Dify 知识库 API），支撑机构私有知识检索。

## 任务分解

### 7.1 通用文件上传

- 集成 ali-oss SDK + multer
- `POST /api/file/upload`（teacher）：图片 / PDF / Word
- 上传策略：multer 内存/临时存储 → OSS 流式直传，避免落地中转
- OSS key 规则：`{tenantId}/{yyyyMM}/{nanoid}{ext}`，返回签名 URL
- 文件类型与大小校验（zod + mimetype 白名单）

### 7.2 RAG 知识库对接

- 调用 Coze/Dify 的知识库文档上传 API
- `POST /api/knowledge/upload`（admin）：
  1. 文件上传 OSS 拿 file_url
  2. 调第三方知识库 API，拿回 document_id
  3. 写 knowledge_docs（status=0 待处理）
- 索引状态查询：轮询/回查第三方状态，更新 status=1 已索引 / 2 失败

### 7.3 知识库管理接口（第 8.6 节）

| Method | Path                  | 说明                             | 角色  |
| :----- | :-------------------- | :------------------------------- | :---- |
| GET    | /api/knowledge/list   | 文档列表（含状态）               | admin |
| POST   | /api/knowledge/delete | 删除文档（同步清理第三方知识库） | admin |

## 验证清单

- [ ] 上传 PDF：OSS 可访问，knowledge_docs 生成记录
- [ ] 状态流转：待处理 → 已索引（或失败可查原因）
- [ ] AI 对话能引用知识库内容回答（RAG 生效）
- [ ] 删除后列表移除，第三方同步清理
