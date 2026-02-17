const { PrismaClient } = require('@prisma/client');
const { createHash } = require('crypto');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = createHash('sha256').update('admin123').digest('hex');

  await prisma.user.upsert({
    where: { email: 'admin@mytrades.local' },
    update: { isActive: true, role: 'ADMIN' },
    create: {
      email: 'admin@mytrades.local',
      name: 'Admin',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  await prisma.strategy.upsert({
    where: { name: 'Default' },
    update: { isActive: true },
    create: { name: 'Default', description: 'Seed strategy', isActive: true },
  });

  console.log('Seed completed');
}

main().finally(async () => {
  await prisma.$disconnect();
});
