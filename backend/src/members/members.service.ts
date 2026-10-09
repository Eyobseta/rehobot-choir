import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';

/**
 * Return the approved member directory (SRS 18).
 * - Approved only.
 * - Search by full name.
 * - Sorted by lastActiveAt desc (recently active first).
 * - No alternate sorting (SRS 18).
 */
export async function listMembers(search?: string) {
  const q = (search ?? '').trim();

  const users = await prisma.user.findMany({
    where: {
      status: 'APPROVED',
      deletedAt: null,
      memberProfile: q
        ? { fullName: { contains: q, mode: 'insensitive' } }
        : undefined,
    },
    orderBy: [{ lastActiveAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      lastActiveAt: true,
      memberProfile: {
        select: {
          fullName: true,
          profilePhotoUrl: true,
        },
      },
    },
  });

  return users.map((u) => ({
    id: u.id,
    fullName: u.memberProfile?.fullName ?? 'Deleted Member',
    profilePhotoUrl: u.memberProfile?.profilePhotoUrl ?? null,
    lastActiveAt: u.lastActiveAt,
  }));
}

/**
 * Get a member profile (SRS 17.3).
 *
 * Visible to other approved members:
 * - profile photo, full name, phone, email, gender, full DOB, joining date.
 * Private:
 * - emergency contact, attendance.
 */
export async function getMemberProfile(viewerId: string, memberId: string) {
  const viewer = await prisma.user.findUnique({ where: { id: viewerId } });
  if (!viewer || viewer.deletedAt || viewer.status !== 'APPROVED') {
    throw ApiError.forbidden('Only approved members can view profiles.');
  }

  const user = await prisma.user.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      phone: true,
      email: true,
      status: true,
      deletedAt: true,
      lastActiveAt: true,
      memberProfile: {
        select: {
          fullName: true,
          profilePhotoUrl: true,
          gender: true,
          dateOfBirth: true,
          joiningDate: true,
        },
      },
    },
  });

  if (!user) throw ApiError.notFound('Member not found.');

  // If the member is deleted, expose only the retained basics (SRS 7.3).
  if (user.deletedAt || user.status === 'DELETED') {
    return {
      id: user.id,
      fullName: 'Deleted Member',
      profilePhotoUrl: user.memberProfile?.profilePhotoUrl ?? null,
      deleted: true,
    };
  }

  return {
    id: user.id,
    fullName: user.memberProfile?.fullName ?? '',
    profilePhotoUrl: user.memberProfile?.profilePhotoUrl ?? null,
    phone: user.phone,
    email: user.email,
    gender: user.memberProfile?.gender ?? null,
    dateOfBirth: user.memberProfile?.dateOfBirth ?? null,
    joiningDate: user.memberProfile?.joiningDate ?? null,
    lastActiveAt: user.lastActiveAt,
    deleted: false,
  };
}

/**
 * Own profile (SRS 17.1 / 17.2).
 * Returns editable + leader-controlled fields separately for clarity.
 */
export async function getOwnProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      email: true,
      role: true,
      status: true,
      memberProfile: {
        select: {
          fullName: true,
          profilePhotoUrl: true,
          gender: true,
          dateOfBirth: true,
          joiningDate: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
        },
      },
    },
  });
  if (!user) throw ApiError.unauthorized();

  return {
    id: user.id,
    role: user.role,
    status: user.status,
    editable: {
      phone: user.phone,
      email: user.email,
      emergencyContactName: user.memberProfile?.emergencyContactName ?? '',
      emergencyContactPhone: user.memberProfile?.emergencyContactPhone ?? '',
      profilePhotoUrl: user.memberProfile?.profilePhotoUrl ?? null,
    },
    official: {
      fullName: user.memberProfile?.fullName ?? '',
      gender: user.memberProfile?.gender ?? '',
      dateOfBirth: user.memberProfile?.dateOfBirth ?? null,
      joiningDate: user.memberProfile?.joiningDate ?? null,
    },
  };
}

/**
 * Update allowed fields only (SRS 17.1).
 * Rejects attempts to edit official fields.
 */
export async function updateOwnProfile(
  userId: string,
  input: {
    email?: string;
    phone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  },
) {
  // Explicitly reject any attempt to change official fields.
  const forbidden = ['fullName', 'gender', 'dateOfBirth', 'joiningDate'];
  for (const key of forbidden) {
    if (key in (input as Record<string, unknown>)) {
      throw ApiError.forbidden(
        `${key} cannot be edited by members. Contact a choir leader.`,
      );
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.unauthorized();

  // Phone uniqueness check.
  if (input.phone !== undefined && input.phone.trim() !== user.phone) {
    const cleanPhone = input.phone.trim();
    if (!cleanPhone) throw ApiError.badRequest('Phone cannot be empty.');
    const clash = await prisma.user.findFirst({
      where: { phone: cleanPhone, deletedAt: null, id: { not: userId } },
    });
    if (clash) {
      throw ApiError.conflict('That phone number is already in use.', 'PHONE_TAKEN');
    }
  }

  // Email uniqueness check.
  if (input.email !== undefined) {
    const cleanEmail = input.email.trim().toLowerCase();
    if (cleanEmail) {
      const clash = await prisma.user.findFirst({
        where: { email: cleanEmail, deletedAt: null, id: { not: userId } },
      });
      if (clash) {
        throw ApiError.conflict('That email is already in use.', 'EMAIL_TAKEN');
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    if (input.email !== undefined || input.phone !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: {
          email:
            input.email !== undefined
              ? input.email.trim().toLowerCase() || null
              : undefined,
          phone: input.phone !== undefined ? input.phone.trim() : undefined,
        },
      });
    }

    if (
      input.emergencyContactName !== undefined ||
      input.emergencyContactPhone !== undefined
    ) {
      await tx.memberProfile.update({
        where: { userId },
        data: {
          emergencyContactName:
            input.emergencyContactName !== undefined
              ? input.emergencyContactName.trim()
              : undefined,
          emergencyContactPhone:
            input.emergencyContactPhone !== undefined
              ? input.emergencyContactPhone.trim()
              : undefined,
        },
      });
    }
  });

  return getOwnProfile(userId);
}

/**
 * Replace the member's profile photo (SRS 17.4).
 */
export async function updateOwnProfilePhoto(
  userId: string,
  newUrl: string,
  newPublicId: string,
) {
  const profile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!profile) throw ApiError.notFound('Profile not found.');

  await prisma.memberProfile.update({
    where: { userId },
    data: {
      profilePhotoUrl: newUrl,
      profilePhotoPublicId: newPublicId,
    },
  });

  return { profilePhotoUrl: newUrl };
}

/**
 * Birthdays today and tomorrow (SRS 9, 16.5).
 * No age is returned.
 */
export async function listUpcomingBirthdays(viewerId: string) {
  const viewer = await prisma.user.findUnique({ where: { id: viewerId } });
  if (!viewer || viewer.deletedAt || viewer.status !== 'APPROVED') {
    throw ApiError.forbidden('Only approved members can view birthdays.');
  }

  const profiles = await prisma.memberProfile.findMany({
    where: {
      user: {
        status: 'APPROVED',
        deletedAt: null,
      },
    },
    select: {
      userId: true,
      fullName: true,
      profilePhotoUrl: true,
      dateOfBirth: true,
    },
  });

  const now = new Date();
  const todayMonth = now.getUTCMonth();
  const todayDay = now.getUTCDate();

  const tomorrow = new Date(now);
  tomorrow.setUTCDate(now.getUTCDate() + 1);
  const tMonth = tomorrow.getUTCMonth();
  const tDay = tomorrow.getUTCDate();

  const today: typeof profiles = [];
  const tomorrowList: typeof profiles = [];

  for (const p of profiles) {
    const m = p.dateOfBirth.getUTCMonth();
    const d = p.dateOfBirth.getUTCDate();
    if (m === todayMonth && d === todayDay) today.push(p);
    else if (m === tMonth && d === tDay) tomorrowList.push(p);
  }

  const shape = (arr: typeof profiles) =>
    arr.map((p) => ({
      userId: p.userId,
      fullName: p.fullName,
      profilePhotoUrl: p.profilePhotoUrl,
    }));

  return {
    today: shape(today),
    tomorrow: shape(tomorrowList),
  };
}

/**
 * Ensure a BirthdayPost exists for the given member for the current UTC year.
 * Returns the post.
 */
async function ensureBirthdayPostFor(userId: string, dateOfBirth: Date) {
  const now = new Date();
  const year = now.getUTCFullYear();

  // Birthday date this year at UTC midnight of the actual DOB month/day.
  const bday = new Date(
    Date.UTC(year, dateOfBirth.getUTCMonth(), dateOfBirth.getUTCDate()),
  );

  const existing = await prisma.birthdayPost.findUnique({
    where: { userId_year: { userId, year } },
  });
  if (existing) return existing;

  return prisma.birthdayPost.create({
    data: {
      userId,
      year,
      birthdayDate: bday,
    },
  });
}

/**
 * Birthdays today and tomorrow (SRS 9, 16.5) with post ids.
 * Each item now carries a `postId` so the client can open the detail view.
 */
export async function listBirthdaysWithPosts(viewerId: string) {
  const viewer = await prisma.user.findUnique({ where: { id: viewerId } });
  if (!viewer || viewer.deletedAt || viewer.status !== 'APPROVED') {
    throw ApiError.forbidden('Only approved members can view birthdays.');
  }

  const now = new Date();
  const todayMonth = now.getUTCMonth();
  const todayDay = now.getUTCDate();

  const tomorrow = new Date(now);
  tomorrow.setUTCDate(now.getUTCDate() + 1);
  const tMonth = tomorrow.getUTCMonth();
  const tDay = tomorrow.getUTCDate();

  const profiles = await prisma.memberProfile.findMany({
    where: {
      user: {
        status: 'APPROVED',
        deletedAt: null,
      },
    },
    select: {
      userId: true,
      fullName: true,
      profilePhotoUrl: true,
      dateOfBirth: true,
    },
  });

  const todayList: typeof profiles = [];
  const tomorrowList: typeof profiles = [];

  for (const p of profiles) {
    const m = p.dateOfBirth.getUTCMonth();
    const d = p.dateOfBirth.getUTCDate();
    if (m === todayMonth && d === todayDay) todayList.push(p);
    else if (m === tMonth && d === tDay) tomorrowList.push(p);
  }

  const shapeWithPost = async (arr: typeof profiles) => {
    const out: {
      userId: string;
      fullName: string;
      profilePhotoUrl: string | null;
      postId: string;
    }[] = [];
    for (const p of arr) {
      const post = await ensureBirthdayPostFor(p.userId, p.dateOfBirth);
      out.push({
        userId: p.userId,
        fullName: p.fullName,
        profilePhotoUrl: p.profilePhotoUrl,
        postId: post.id,
      });
    }
    return out;
  };

  return {
    today: await shapeWithPost(todayList),
    tomorrow: await shapeWithPost(tomorrowList),
  };
}