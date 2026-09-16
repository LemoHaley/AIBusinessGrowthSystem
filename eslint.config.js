// ESLint 9 扁平配置：TypeScript 规范检查（plan.md 第 2 节代码规范）
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // 忽略构建产物与依赖目录
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // 下划线前缀的参数/变量视为有意未使用（如 Express 错误中间件的 _next 签名约定）
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
