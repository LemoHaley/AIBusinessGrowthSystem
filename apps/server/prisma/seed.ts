// 种子数据：默认租户 + admin 账号 + 默认计费单价 + 默认 Agent 配置
// 执行入口：pnpm --filter @artedu/server exec prisma db seed（package.json 的 prisma.seed 配置）
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// admin 后台登录默认密码（生产环境必须修改）
const ADMIN_DEFAULT_PASSWORD = 'admin123';

async function main() {
  // 1. 默认租户（演示机构）
  const tenant = await prisma.tenant.upsert({
    where: { id: 1n },
    update: {},
    create: {
      id: 1n,
      name: '演示舞蹈艺术中心',
      contact: '400-000-0000',
      expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 一年后到期
      status: 1,
    },
  });
  console.log(`租户已就绪: id=${tenant.id} name=${tenant.name}`);

  // 2. admin 账号（密码 bcrypt 加密，仅用于 Web 后台登录）
  const passwordHash = await bcrypt.hash(ADMIN_DEFAULT_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { tenantId_openid: { tenantId: 1n, openid: 'admin' } },
    update: {},
    create: {
      tenantId: 1n,
      openid: 'admin', // 后台账号无微信 openid，用固定占位符满足唯一约束
      nickname: '系统管理员',
      phone: '13800000000',
      password: passwordHash,
      role: 'admin',
      status: 1,
    },
  });
  console.log(`admin 账号已就绪: id=${admin.id} nickname=${admin.nickname}`);

  // 3. 默认计费单价三条（tenant_id=0 表示全局默认价，租户未自定义时兜底）
  const defaultPrices = [
    { agentType: 'report', price: 10 }, // 成长报告：10 积分/次
    { agentType: 'copywriting', price: 5 }, // 招生文案：5 积分/次
    { agentType: 'chat', price: 1 }, // AI 对话：1 积分/次
  ];
  for (const p of defaultPrices) {
    await prisma.pointPrice.upsert({
      where: { agentType_tenantId: { agentType: p.agentType, tenantId: 0n } },
      update: {},
      create: { ...p, tenantId: 0n, status: 1 },
    });
  }
  console.log(
    `默认计费单价已就绪: ${defaultPrices.map((p) => `${p.agentType}=${p.price}`).join(', ')}`,
  );

  // 4. 默认 Agent 配置（provider=coze，bot_id 读环境变量 COZE_BOT_ID）
  const cozeBotId = process.env.COZE_BOT_ID || 'your_bot_id';
  const defaultAgents = [
    {
      agentType: 'report',
      promptTemplate:
        '你是一位专业的舞蹈艺术教育老师，请根据学员的课堂表现生成一份温暖、专业、有成长建议的课后点评报告。要求：1. 肯定本节课的进步；2. 指出需要改进的动作要点；3. 给出在家练习建议；4. 语气亲切，家长可读性强。',
    },
    {
      agentType: 'copywriting',
      promptTemplate:
        '你是一位教培行业资深招生文案专家，请根据机构信息与活动主题，撰写一条适合朋友圈/公众号发布的招生文案。要求：1. 突出机构特色；2. 制造紧迫感；3. 附行动号召（预约试听）。',
    },
    {
      agentType: 'chat',
      promptTemplate:
        '你是舞蹈/艺术教培机构的 AI 助手，回答家长关于课程安排、孩子学习进展、艺术教育的常见问题。回答保持友好、简洁、专业。',
    },
  ];
  for (const a of defaultAgents) {
    await prisma.agentConfig.upsert({
      where: { agentType_tenantId: { agentType: a.agentType, tenantId: 0n } },
      update: {},
      create: {
        ...a,
        provider: 'coze',
        botId: cozeBotId,
        tenantId: 0n,
        status: 1,
      },
    });
  }
  console.log(
    `默认 Agent 配置已就绪: ${defaultAgents.map((a) => a.agentType).join(', ')}（provider=coze）`,
  );

  console.log('\n全部种子数据写入完成。');
  console.log(
    `admin 登录信息: 用户名=13800000000 密码=${ADMIN_DEFAULT_PASSWORD}（昵称=系统管理员）`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('种子数据写入失败:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
