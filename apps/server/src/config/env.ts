/**
 * 环境配置加载：dotenv 读取 + zod 校验（plan.md 任务 1.2）
 * 校验失败立即退出，避免服务带病启动
 */
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** MySQL 连接串（Prisma datasource 使用） */
  DATABASE_URL: z.string().min(1, '缺少 DATABASE_URL'),
  /** Redis 连接串 */
  REDIS_URL: z.string().min(1, '缺少 REDIS_URL'),
  /** JWT 签名密钥 */
  JWT_SECRET: z.string().min(1, '缺少 JWT_SECRET'),
  /** 微信小程序凭证 */
  WX_APPID: z.string().min(1, '缺少 WX_APPID'),
  WX_SECRET: z.string().min(1, '缺少 WX_SECRET'),
  /** Coze AI 服务凭证 */
  COZE_API_KEY: z.string().min(1, '缺少 COZE_API_KEY'),
  COZE_BOT_ID: z.string().min(1, '缺少 COZE_BOT_ID'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // 启动期直接打印缺失变量并退出，提示开发者补齐 .env
  const missing = Object.entries(parsed.error.flatten().fieldErrors)
    .map(([key, errors]) => `${key}: ${errors?.join(', ')}`)
    .join('; ');
  console.error(`[env] 环境变量校验失败 -> ${missing}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
