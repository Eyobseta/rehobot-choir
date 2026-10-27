// prisma/wipe-and-create-admin.ts
import 'dotenv/config';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const ARGON2_OPTIONS: Parameters<typeof argon2.hash>[1] = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

async function main() {
  // 👇 CHANGE THESE TO YOUR NEW ADMIN DETAILS 👇
  const newAdminPhone = '**********'; 
  const newAdminPassword = '*********';
  const newAdminEmail = '**********';

  console.log('⚠️  WARNING: Deleting all existing ADMIN accounts...');

  // 1. Find all existing Admins
  const existingAdmins = await prisma.user.findMany({
    where: { role: UserRole.ADMIN },
    select: { id: true },
  });

  const adminIds = existingAdmins.map((u) => u.id);

  if (adminIds.length > 0) {
    // 2. Clean up relational data for these Admins
    await prisma.$transaction(
      async (tx) => {
        // Find any chat groups managed by these admins
        const managedGroups = await tx.chatGroup.findMany({
          where: { managerId: { in: adminIds } },
          select: { id: true }
        });

        // Delete the groups entirely to free up the foreign key
        if (managedGroups.length > 0) {
          const groupIds = managedGroups.map(g => g.id);
          await tx.chatGroup.deleteMany({ where: { id: { in: groupIds } } });
        }

        // Delete all related records
        await tx.session.deleteMany({ where: { userId: { in: adminIds } } });
        await tx.accountLock.deleteMany({ where: { userId: { in: adminIds } } });
        await tx.notification.deleteMany({ where: { recipientId: { in: adminIds } } });
        await tx.pushToken.deleteMany({ where: { userId: { in: adminIds } } });
        await tx.notificationPreference.deleteMany({ where: { userId: { in: adminIds } } });
        await tx.memberProfile.deleteMany({ where: { userId: { in: adminIds } } });
        await tx.user.deleteMany({ where: { id: { in: adminIds } } });
      },
      {
        timeout: 30000, // <--- THIS GIVES IT 30 SECONDS TO FINISH
      }
    );
    
    console.log(`✅ Deleted ${adminIds.length} old Admin account(s) and cleaned up their groups.`);
  } else {
    console.log('ℹ️  No existing Admins found. Skipping deletion.');
  }

  // 3. Create the new Admin
  console.log(`\nCreating new Admin: ${newAdminPhone}`);
  const passwordHash = await argon2.hash(newAdminPassword, ARGON2_OPTIONS);

  await prisma.user.create({
    data: {
      phone: newAdminPhone,
      email: newAdminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.APPROVED,
      mustChangePassword: false,
    },
  });

  console.log('\n🎉 SUCCESS! New Admin created:');
  console.log(`📱 Phone:    ${newAdminPhone}`);
  console.log(`🔑 Password: ${newAdminPassword}`);
  console.log(`✉️  Email:    ${newAdminEmail}`);
}

main()
  .catch((e) => {
    console.error('❌ Failed to recreate admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });