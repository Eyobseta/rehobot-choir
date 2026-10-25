import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { todayEthiopian, addEthDays, EthDate } from '../utils/ethiopianCalendar';
import { ethFields } from '../utils/eth-fields';

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
          dateOfBirthEthYear: true,
          dateOfBirthEthMonth: true,
          dateOfBirthEthDay: true,
          joiningDateEthYear: true,
          joiningDateEthMonth: true,
          joiningDateEthDay: true,
        },
      },
    },
  });

  if (!user) throw ApiError.notFound('Member not found.');

  if (user.deletedAt || user.status === 'DELETED') {
    return {
      id: user.id,
      fullName: 'Deleted Member',
      profilePhotoUrl: user.memberProfile?.profilePhotoUrl ?? null,
      deleted: true,
    };
  }

  const p = user.memberProfile;

  return {
    id: user.id,
    fullName: p?.fullName ?? '',
    profilePhotoUrl: p?.profilePhotoUrl ?? null,
    phone: user.phone,
    email: user.email,
    gender: p?.gender ?? null,
    dateOfBirth: p?.dateOfBirthEthYear ? {
      year: p.dateOfBirthEthYear,
      month: p.dateOfBirthEthMonth,
      day: p.dateOfBirthEthDay,
    } : null,
    joiningDate: p?.joiningDateEthYear ? {
      year: p.joiningDateEthYear,
      month: p.joiningDateEthMonth,
      day: p.joiningDateEthDay,
    } : null,
    lastActiveAt: user.lastActiveAt,
    deleted: false,
  };
}

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
          dateOfBirthEthYear: true,
          dateOfBirthEthMonth: true,
          dateOfBirthEthDay: true,
          joiningDateEthYear: true,
          joiningDateEthMonth: true,
          joiningDateEthDay: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
        },
      },
    },
  });
  if (!user) throw ApiError.unauthorized();

  const p = user.memberProfile;

  return {
    id: user.id,
    role: user.role,
    status: user.status,
    editable: {
      phone: user.phone,
      email: user.email,
      emergencyContactName: p?.emergencyContactName ?? '',
      emergencyContactPhone: p?.emergencyContactPhone ?? '',
      profilePhotoUrl: p?.profilePhotoUrl ?? null,
    },
    official: {
      fullName: p?.fullName ?? '',
      gender: p?.gender ?? '',
      dateOfBirth: p?.dateOfBirthEthYear ? {
        year: p.dateOfBirthEthYear,
        month: p.dateOfBirthEthMonth,
        day: p.dateOfBirthEthDay,
      } : null,
      joiningDate: p?.joiningDateEthYear ? {
        year: p.joiningDateEthYear,
        month: p.joiningDateEthMonth,
        day: p.joiningDateEthDay,
      } : null,
    },
  };
}

export async function updateOwnProfile(
  userId: string,
  input: {
    email?: string;
    phone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  },
) {
  const forbidden = ['fullName', 'gender', 'dateOfBirth', 'joiningDate'];
  for (const key of forbidden) {
    if (key in (input as Record<string, unknown>)) {
      throw ApiError.forbidden(`${key} cannot be edited by members. Contact a choir leader.`);
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.unauthorized();

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
          email: input.email !== undefined ? input.email.trim().toLowerCase() || null : undefined,
          phone: input.phone !== undefined ? input.phone.trim() : undefined,
        },
      });
    }

    if (input.emergencyContactName !== undefined || input.emergencyContactPhone !== undefined) {
      await tx.memberProfile.update({
        where: { userId },
        data: {
          emergencyContactName: input.emergencyContactName !== undefined ? input.emergencyContactName.trim() : undefined,
          emergencyContactPhone: input.emergencyContactPhone !== undefined ? input.emergencyContactPhone.trim() : undefined,
        },
      });
    }
  });

  return getOwnProfile(userId);
}

export async function updateOwnProfilePhoto(userId: string, newUrl: string, newPublicId: string) {
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

export async function listBirthdaysWithPosts(viewerId: string) {
  const viewer = await prisma.user.findUnique({ where: { id: viewerId } });
  if (!viewer || viewer.deletedAt || viewer.status !== 'APPROVED') {
    throw ApiError.forbidden('Only approved members can view birthdays.');
  }

  const today = todayEthiopian();
  const tomorrow = addEthDays(today, 1);

  const profiles = await prisma.memberProfile.findMany({
    where: { user: { status: 'APPROVED', deletedAt: null } },
    select: {
      userId: true,
      fullName: true,
      profilePhotoUrl: true,
      dateOfBirthEthMonth: true,
      dateOfBirthEthDay: true,
    },
  });

  const todayList = profiles.filter((p) => p.dateOfBirthEthMonth === today.month && p.dateOfBirthEthDay === today.day);
  const tomorrowList = profiles.filter((p) => p.dateOfBirthEthMonth === tomorrow.month && p.dateOfBirthEthDay === tomorrow.day);

  const shapeWithPost = async (arr: typeof profiles) => {
    const out: {
      userId: string;
      fullName: string;
      profilePhotoUrl: string | null;
      postId: string;
    }[] = [];
    for (const p of arr) {
      const post = await ensureBirthdayPostFor(p.userId, p.dateOfBirthEthMonth, p.dateOfBirthEthDay);
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

async function ensureBirthdayPostFor(userId: string, dobEthMonth: number, dobEthDay: number) {
  const today = todayEthiopian();
  
  const bday: EthDate = { year: today.year, month: dobEthMonth, day: dobEthDay };

  const existing = await prisma.birthdayPost.findUnique({
    where: { userId_year: { userId, year: today.year } },
  });
  if (existing) return existing;

  return prisma.birthdayPost.create({
    data: {
      userId,
      year: today.year,
      ...(ethFields(bday, 'birthday') as any),
    },
  });
}