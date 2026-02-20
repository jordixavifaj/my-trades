const { PrismaClient } = require('@prisma/client');
const { createHash } = require('crypto');

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = createHash('sha256').update('admin123').digest('hex');

  // --- Users ---
  const admin = await prisma.user.upsert({
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

  const mentor = await prisma.user.upsert({
    where: { email: 'mentor@mytrades.local' },
    update: { isActive: true, role: 'MENTOR' },
    create: {
      email: 'mentor@mytrades.local',
      name: 'Mentor Demo',
      passwordHash,
      role: 'MENTOR',
      isActive: true,
    },
  });

  const student1 = await prisma.user.upsert({
    where: { email: 'alumno1@mytrades.local' },
    update: { isActive: true, role: 'STUDENT' },
    create: {
      email: 'alumno1@mytrades.local',
      name: 'Alumno Uno',
      passwordHash,
      role: 'STUDENT',
      isActive: true,
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: 'alumno2@mytrades.local' },
    update: { isActive: true, role: 'STUDENT' },
    create: {
      email: 'alumno2@mytrades.local',
      name: 'Alumno Dos',
      passwordHash,
      role: 'STUDENT',
      isActive: true,
    },
  });

  // --- Strategy ---
  await prisma.strategy.upsert({
    where: { name: 'Default' },
    update: { isActive: true },
    create: { name: 'Default', description: 'Seed strategy', isActive: true },
  });

  // --- Community ---
  const community = await prisma.community.upsert({
    where: { name: 'Trading Academy' },
    update: { isActive: true },
    create: { name: 'Trading Academy', description: 'Comunidad principal de trading', isActive: true },
  });

  // Add all users to the community (skip if already exists)
  for (const userId of [admin.id, mentor.id, student1.id, student2.id]) {
    await prisma.communityMember.upsert({
      where: { userId_communityId: { userId, communityId: community.id } },
      update: {},
      create: { userId, communityId: community.id },
    });
  }

  // --- Mentor Assignment ---
  await prisma.mentorAssignment.upsert({
    where: { mentorId_studentId: { mentorId: mentor.id, studentId: student1.id } },
    update: {},
    create: { mentorId: mentor.id, studentId: student1.id },
  });

  await prisma.mentorAssignment.upsert({
    where: { mentorId_studentId: { mentorId: mentor.id, studentId: student2.id } },
    update: {},
    create: { mentorId: mentor.id, studentId: student2.id },
  });

  console.log('Seed completed');
  console.log('  Users: admin@mytrades.local, mentor@mytrades.local, alumno1@mytrades.local, alumno2@mytrades.local');
  console.log('  Password: admin123 (for all)');
  console.log('  Community: Trading Academy (all users)');
  console.log('  Mentor -> Students: mentor -> alumno1, alumno2');
}

main().finally(async () => {
  await prisma.$disconnect();
});
