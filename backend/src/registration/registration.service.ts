import { prisma } from '../db/prisma';
import { hashPassword } from '../auth/password';
import { ApiError } from '../utils/ApiError';
import { ApplicationStatus, UserRole, UserStatus } from '@prisma/client';
import { uploadBuffer, UploadResult } from '../storage/cloudinary';
import { EthDate } from '../utils/ethiopianCalendar';
import { ethFields } from '../utils/eth-fields';

export type RegisterInput = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  gender: string;
  dateOfBirth: EthDate;
  emergencyContactName: string;
  emergencyContactPhone: string;
  joiningDate?: EthDate;
  photo: { buffer: Buffer; mimetype: string };
};

export async function register(input: RegisterInput) {
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();

  if (!input.fullName.trim()) throw ApiError.badRequest('Full name is required.');
  if (!phone) throw ApiError.badRequest('Phone is required.');
  if (!email) throw ApiError.badRequest('Email is required.');
  if (!input.password || input.password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters.');
  }
  if (!input.gender.trim()) throw ApiError.badRequest('Gender is required.');
  if (!input.dateOfBirth) throw ApiError.badRequest('Date of birth is required.');
  if (!input.emergencyContactName.trim() || !input.emergencyContactPhone.trim()) {
    throw ApiError.badRequest('Emergency contact is required.');
  }

  const activeUser = await prisma.user.findFirst({
    where: { phone, deletedAt: null },
  });
  if (activeUser) {
    throw ApiError.conflict('This phone number is already registered.', 'PHONE_TAKEN');
  }

  const pendingApp = await prisma.registrationApplication.findFirst({
    where: { phone, status: ApplicationStatus.PENDING },
  });
  if (pendingApp) {
    throw ApiError.conflict('An application with this phone number is already pending review.', 'APPLICATION_PENDING');
  }

  const uploaded: UploadResult = await uploadBuffer(
    input.photo.buffer,
    'rehobot/profile-photos',
    `app_${phone}`,
  );

  const passwordHash = await hashPassword(input.password);

  const app = await prisma.registrationApplication.create({
    data: {
      fullName: input.fullName.trim(),
      phone,
      email,
      passwordHash,
      profilePhotoUrl: uploaded.url,
      profilePhotoPublicId: uploaded.publicId,
      gender: input.gender.trim(),
      emergencyContactName: input.emergencyContactName.trim(),
      emergencyContactPhone: input.emergencyContactPhone.trim(),
      status: ApplicationStatus.PENDING,
      ...(ethFields(input.dateOfBirth, 'dateOfBirth') as any),
      ...(input.joiningDate ? (ethFields(input.joiningDate, 'joiningDate') as any) : {}),
    },
  });

  return { applicationId: app.id, status: app.status };
}

export async function getStatus(phone: string) {
  const cleanPhone = phone.trim();
  if (!cleanPhone) throw ApiError.badRequest('Phone is required.');

  const app = await prisma.registrationApplication.findFirst({
    where: { phone: cleanPhone },
    orderBy: { createdAt: 'desc' },
  });

  if (!app) {
    throw ApiError.notFound('No application found for this phone number.');
  }

  return {
    status: app.status,
    rejectionReason: app.status === ApplicationStatus.REJECTED ? app.rejectionReason : null,
    createdAt: app.createdAt,
    reviewedAt: app.reviewedAt,
  };
}

export async function listPending() {
  return prisma.registrationApplication.findMany({
    where: { status: ApplicationStatus.PENDING },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      gender: true,
      dateOfBirthEthYear: true,
      dateOfBirthEthMonth: true,
      dateOfBirthEthDay: true,
      joiningDateEthYear: true,
      joiningDateEthMonth: true,
      joiningDateEthDay: true,
      profilePhotoUrl: true,
      createdAt: true,
    },
  });
}

export async function getApplication(id: string) {
  const app = await prisma.registrationApplication.findUnique({ where: { id } });
  if (!app) throw ApiError.notFound('Application not found.');
  const { passwordHash, ...safe } = app;
  return safe;
}

export async function approveApplication(applicationId: string, leaderUserId: string) {
  const app = await prisma.registrationApplication.findUnique({
    where: { id: applicationId },
  });
  if (!app) throw ApiError.notFound('Application not found.');
  if (app.status !== ApplicationStatus.PENDING) {
    throw ApiError.conflict('Application is not pending.', 'NOT_PENDING');
  }

  const activeUser = await prisma.user.findFirst({
    where: { phone: app.phone, deletedAt: null },
  });
  if (activeUser) {
    throw ApiError.conflict('This phone number is already in use.', 'PHONE_TAKEN');
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        phone: app.phone,
        email: app.email,
        passwordHash: app.passwordHash,
        role: UserRole.MEMBER,
        status: UserStatus.APPROVED,
      },
    });

    await tx.memberProfile.create({
      data: {
        userId: user.id,
        fullName: app.fullName,
        gender: app.gender,
        emergencyContactName: app.emergencyContactName,
        emergencyContactPhone: app.emergencyContactPhone,
        profilePhotoUrl: app.profilePhotoUrl,
        profilePhotoPublicId: app.profilePhotoPublicId,
        dateOfBirthEthYear: app.dateOfBirthEthYear,
        dateOfBirthEthMonth: app.dateOfBirthEthMonth,
        dateOfBirthEthDay: app.dateOfBirthEthDay,
        dateOfBirthGregorian: app.dateOfBirthGregorian,
        joiningDateEthYear: app.joiningDateEthYear,
        joiningDateEthMonth: app.joiningDateEthMonth,
        joiningDateEthDay: app.joiningDateEthDay,
        joiningDateGregorian: app.joiningDateGregorian,
      },
    });

    await tx.registrationApplication.update({
      where: { id: app.id },
      data: {
        status: ApplicationStatus.APPROVED,
        reviewedByUserId: leaderUserId,
        reviewedAt: new Date(),
      },
    });

    return user;
  });

  return { userId: result.id };
}

export async function rejectApplication(applicationId: string, leaderUserId: string, reason: string) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw ApiError.badRequest('Rejection reason is required.');
  }

  const app = await prisma.registrationApplication.findUnique({
    where: { id: applicationId },
  });
  if (!app) throw ApiError.notFound('Application not found.');
  if (app.status !== ApplicationStatus.PENDING) {
    throw ApiError.conflict('Application is not pending.', 'NOT_PENDING');
  }

  await prisma.registrationApplication.update({
    where: { id: app.id },
    data: {
      status: ApplicationStatus.REJECTED,
      rejectionReason: trimmedReason,
      reviewedByUserId: leaderUserId,
      reviewedAt: new Date(),
    },
  });

  return { ok: true };
}