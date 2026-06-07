import { PrismaClient, UserRole, UserStatus, OrgPlan, ProjectStatus, MemberRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Создаем Организацию
  const organization = await prisma.organization.upsert({
    where: { slug: 'eventhon-hq' },
    update: {},
    create: {
      name: 'Eventhon HQ',
      slug: 'eventhon-hq',
      plan: OrgPlan.ENTERPRISE,
    },
  });

  console.log(`✅ Organization created: ${organization.name}`);

  // 2. Создаем Админа
  const hashedPassword = await bcrypt.hash('admin123456', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eventhon.io' },
    update: {},
    create: {
      email: 'admin@eventhon.io',
      passwordHash: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      role: UserRole.ORG_OWNER,
      status: UserStatus.ACTIVE,
    },
  });

  // Добавляем админа в организацию
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: admin.id,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      userId: admin.id,
      role: MemberRole.OWNER,
    },
  });

  console.log(`✅ Admin user created and linked to organization: ${admin.email}`);

  // 3. Создаем тестовый Проект
  const project = await prisma.project.create({
    data: {
      name: 'Eventhon Platform Launch',
      description: 'Main project for tracking platform development and launch',
      slug: 'evt-platform-launch',
      status: ProjectStatus.ACTIVE,
      organizationId: organization.id,
      ownerId: admin.id,
      members: {
        create: {
          userId: admin.id,
          role: MemberRole.OWNER,
        },
      },
    },
  });

  console.log(`✅ Test project created: ${project.name}`);

  console.log('🚀 Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
