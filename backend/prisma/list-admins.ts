// prisma/list-admins.ts
import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all Admin accounts...\n');

  const admins = await prisma.user.findMany({
    where: { role: UserRole.ADMIN },
    select: {
      id: true,
      phone: true,
      email: true,
      status: true,
      createdAt: true,
      lastActiveAt: true,
    },
  });

  if (admins.length === 0) {
    console.log('❌ No Admin accounts found in the database.');
    return;
  }

  console.table(admins);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });