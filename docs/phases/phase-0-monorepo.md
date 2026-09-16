# 阶段 0：Monorepo 骨架

| 属性         | 值                                             |
| :----------- | :--------------------------------------------- |
| 状态         | 已完成                                         |
| 前置依赖     | 无                                             |
| 对应 plan.md | 任务 1.1                                       |
| 提交节点     | `chore: 阶段0 初始化 monorepo 骨架`（9a06bc3） |

## 目标

建立 pnpm workspace 四包结构与代码规范工具链，使后续所有阶段的代码在统一工程规范下开发。

## 实际产出

### 工程结构

```text
AIBusinessGrowthSystem/
├── apps/
│   ├── server/              @artedu/server   Express + TS 后端（本阶段为最简入口）
│   ├── admin/               @artedu/admin    占位（阶段 8 初始化 Vite 脚手架）
│   └── miniapp/             @artedu/miniapp 占位（阶段 9 初始化 uni-app 脚手架）
├── packages/
│   └── shared/              @artedu/shared   三端共享 TS 包（类型/常量）
├── pnpm-workspace.yaml      apps/* + packages/*；allowBuilds: esbuild
├── tsconfig.base.json       TS 严格模式统一基线（ES2022 + NodeNext）
├── eslint.config.js         ESLint 扁平配置 + typescript-eslint
├── commitlint.config.js     Conventional Commits
├── .prettierrc / .prettierignore
└── .husky/pre-commit + commit-msg
```

### 配置要点

- server 通过 `"@artedu/shared": "workspace:*"` 显式引用共享包（pnpm 11 不自动链接）
- dev 脚本：`tsx watch src/main.ts`（热更新）
- pre-commit：lint-staged（`eslint --fix` + `prettier --write`）
- commit-msg：commitlint（中文描述，如 `feat: 阶段3 ...`）

## 验证结果（全部通过）

- `pnpm install` 成功（含 workspace 链接）
- `pnpm -r build`：shared + server 编译通过，server 成功 import shared
- `pnpm lint` 通过
- 两次提交均触发 hooks（lint-staged 处理 16 个文件，commitlint 校验通过）

## 环境备忘（Windows）

1. PowerShell 不支持 `&&`，链式命令用 `;`
2. pnpm 11 不自动链接 workspace 包，必须显式 `workspace:*` 协议
3. TypeScript 锁定 6.x：typescript-eslint 暂不支持 TS 7
4. 沙箱环境拒绝写 `.git/objects`，git 提交需在非沙箱模式执行
