import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminUsername = 'admin';

  // 检查管理员账号是否已存在
  const existing = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (existing) {
    console.log('管理员账号已存在，跳过初始化');
    return;
  }

  // 创建默认管理员账号
  const hashedPassword = await bcrypt.hash('123456', 10);

  await prisma.user.create({
    data: {
      username: adminUsername,
      password: hashedPassword,
      realName: 'admin',
      email: null,
      roles: JSON.stringify(['admin']),
      isActive: true,
    },
  });

  console.log('默认管理员账号创建成功：admin / 123456');
}

main()
  .catch((e) => {
    console.error('初始化数据失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
