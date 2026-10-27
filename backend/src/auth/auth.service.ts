import { prisma } from '../db/prisma';
import { hashPassword, verifyPassword } from './password';
import { issueTokens } from './jwt';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '@prisma/client';
import { verifyRefreshToken } from './jwt';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour (SRS 6.8)

export type LoginInput = {
  phone: string;
  password: string;
  deviceLabel?: string;
};

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string;
    email: string | null;
    role: UserRole;
    status: string;
  };
};

/**
 * Member/Leader login by phone + password (SRS 6.1).
 */
export async function loginWithPhone(input: LoginInput): Promise<LoginResult> {
  const phone = input.phone.trim();
  if (!phone || !input.password) {
    throw ApiError.badRequest('Phone and password are required.');
  }

  const user = await prisma.user.findUnique({ where: { phone } });

  // Do not reveal whether the phone exists — SRS 27.
  if (!user || user.deletedAt) {
    throw ApiError.unauthorized('Invalid phone or password.', 'INVALID_CREDENTIALS');
  }

  // Only APPROVED accounts may log in (SRS 5.2, 5.6).
  if (user.status !== 'APPROVED') {
    throw new ApiError(
      403,
      'ACCOUNT_NOT_APPROVED',
      'Your account is not approved. Please check your registration status.',
    );
  }

  // Check lock (SRS 6.8)
  const lock = await prisma.accountLock.findUnique({ where: { userId: user.id } });
  if (lock?.lockedUntil && lock.lockedUntil > new Date()) {
    throw new ApiError(
      423,
      'ACCOUNT_LOCKED',
      'Account temporarily locked due to failed login attempts.',
    );
  }

  // Verify password
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) {
    await recordFailedAttempt(user.id);
    throw ApiError.unauthorized('Invalid phone or password.', 'INVALID_CREDENTIALS');
  }

  // Reset lock on success
  await prisma.accountLock.upsert({
    where: { userId: user.id },
    create: { userId: user.id, failedAttempts: 0 },
    update: { failedAttempts: 0, lockedUntil: null },
  });

  // --- One active device rule (SRS 6.5) ---
  // Revoke every existing session for this user before creating a new one.
  await prisma.session.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // --- Create session ---
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: '', // Set below — must be created first to get an id.
      deviceLabel: input.deviceLabel ?? null,
    },
  });

  // --- Issue tokens ---
  const tokens = issueTokens(
    { sub: user.id, role: user.role, sid: session.id },
    { sub: user.id, sid: session.id, v: 1 },
  );

  // --- Store hash of refresh token for rotation/revocation ---
  const refreshHash = await hashPassword(tokens.refreshToken);
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash: refreshHash, lastUsedAt: new Date() },
  });

  // --- Update user's last activity ---
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  };
}

/**
 * Record failed login attempt + lock if threshold reached (SRS 6.8).
 */
async function recordFailedAttempt(userId: string): Promise<void> {
  const existing = await prisma.accountLock.findUnique({ where: { userId } });
  const attempts = (existing?.failedAttempts ?? 0) + 1;

  const lockedUntil =
    attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null;

  await prisma.accountLock.upsert({
    where: { userId },
    create: {
      userId,
      failedAttempts: attempts,
      lockedUntil,
      lastFailedAt: new Date(),
    },
    update: {
      failedAttempts: attempts,
      lockedUntil,
      lastFailedAt: new Date(),
    },
  });
}

/**
 * Member changes own password (SRS 20.2, 17.1).
 * Requires the current password. Clears mustChangePassword.
 */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('Current and new password are required.');
  }
  if (newPassword.length < 8) {
    throw ApiError.badRequest('New password must be at least 8 characters.');
  }
  if (currentPassword === newPassword) {
    throw ApiError.badRequest('New password must differ from current password.');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    throw ApiError.unauthorized();
  }

  const ok = await verifyPassword(user.passwordHash, currentPassword);
  if (!ok) {
    throw ApiError.unauthorized('Current password is incorrect.', 'INVALID_PASSWORD');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });

  return { ok: true };
}

/**
 * Leader resets a member's password (SRS 6.7).
 * Accepts an optional custom password. Falls back to a generated one if not provided.
 */
export async function leaderResetMemberPassword(
  leaderUserId: string,
  targetUserId: string,
  newPassword?: string,
) {
  if (leaderUserId === targetUserId) {
    throw ApiError.badRequest('Use change-password to change your own password.');
  }

  // 1. Fetch the person making the request (the Actor)
  const actor = await prisma.user.findUnique({ where: { id: leaderUserId } });
  if (!actor || actor.deletedAt || actor.status !== 'APPROVED') {
    throw ApiError.unauthorized();
  }

  // 2. Fetch the target user
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.deletedAt) {
    throw ApiError.notFound('Member not found.');
  }

  // 3. Permission checks
  if (actor.role !== 'ADMIN') {
    // If actor is just a LEADER, they cannot reset other LEADERs or ADMINs.
    if (target.role === 'ADMIN') {
      throw ApiError.forbidden('Cannot reset the admin password from here.');
    }
    if (target.role === 'LEADER') {
      throw ApiError.forbidden('Only the System Administrator (ADMIN) can reset a leader password.');
    }
  } else {
    // If actor is an ADMIN, they cannot reset other ADMINs (to prevent lockouts)
    if (target.role === 'ADMIN') {
      throw ApiError.forbidden('Admins cannot reset other Admins passwords.');
    }
  }

  let finalPassword = newPassword?.trim();
  if (finalPassword) {
    if (finalPassword.length < 8) {
      throw ApiError.badRequest('New password must be at least 8 characters.');
    }
  } else {
    finalPassword = generateTempPassword(10);
  }

  const passwordHash = await hashPassword(finalPassword);

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      passwordHash,
      mustChangePassword: true,
    },
  });

  // Revoke all existing sessions for this user — force re-login.
  await prisma.session.updateMany({
    where: { userId: targetUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { temporaryPassword: finalPassword };
}

function generateTempPassword(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Member self-deletes (SRS 7.1, 7.3).
 */
export async function deleteOwnAccount(userId: string, password: string) {
  if (!password) throw ApiError.badRequest('Password is required.');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    throw ApiError.unauthorized();
  }
  if (user.role === 'ADMIN') {
    throw ApiError.forbidden('Admin cannot self-delete here.');
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    throw ApiError.unauthorized('Password is incorrect.', 'INVALID_PASSWORD');
  }

  await performSoftDelete(userId);
  return { ok: true };
}

/**
 * Leader deletes a member (SRS 7.2).
 */
export async function leaderDeleteMember(
  leaderUserId: string,
  targetUserId: string,
  leaderPassword: string,
) {
  if (!leaderPassword) throw ApiError.badRequest('Your password is required.');

  if (leaderUserId === targetUserId) {
    throw ApiError.badRequest('Use delete-account to delete your own account.');
  }

  const leader = await prisma.user.findUnique({ where: { id: leaderUserId } });
  if (!leader || leader.deletedAt) throw ApiError.unauthorized();

  const ok = await verifyPassword(leader.passwordHash, leaderPassword);
  if (!ok) {
    throw ApiError.unauthorized('Your password is incorrect.', 'INVALID_PASSWORD');
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.deletedAt) {
    throw ApiError.notFound('Member not found.');
  }
  if (target.role === 'LEADER') {
    throw ApiError.forbidden('Leaders cannot delete other leaders.');
  }
  if (target.role === 'ADMIN') {
    throw ApiError.forbidden('Cannot delete the admin account.');
  }

  await performSoftDelete(targetUserId);
  return { ok: true };
}

async function performSoftDelete(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const tombstonePhone = `deleted_${user.id}`;
  const tombstonePassword = await hashPassword(
    Math.random().toString(36).slice(2) + Date.now().toString(36),
  );

  await prisma.$transaction(async (tx) => {
    await tx.memberProfile.deleteMany({ where: { userId } });

    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        phone: tombstonePhone,
        email: null,
        passwordHash: tombstonePassword,
        status: 'DELETED',
        deletedAt: new Date(),
        mustChangePassword: false,
      },
    });
  });
}

export async function findMemberByPhone(phone: string) {
  const clean = phone.trim();
  if (!clean) throw ApiError.badRequest('Phone is required.');

  const user = await prisma.user.findUnique({
    where: { phone: clean },
    select: {
      id: true,
      phone: true,
      email: true,
      role: true,
      status: true,
      deletedAt: true,
      mustChangePassword: true,
      memberProfile: {
        select: {
          fullName: true,
          profilePhotoUrl: true,
          gender: true,
        },
      },
    },
  });

  if (!user || user.deletedAt) {
    throw ApiError.notFound('No active member with that phone number.');
  }

  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    fullName: user.memberProfile?.fullName ?? null,
    profilePhotoUrl: user.memberProfile?.profilePhotoUrl ?? null,
  };
}

export async function refreshSession(
  refreshToken: string,
  deviceLabel?: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string;
    email: string | null;
    role: UserRole;
    status: string;
  };
}> {
  if (!refreshToken || !refreshToken.trim()) {
    throw ApiError.unauthorized('Refresh token is required.', 'NO_REFRESH_TOKEN');
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Refresh token is invalid or expired.', 'INVALID_REFRESH_TOKEN');
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
  });
  if (!session || session.revokedAt || session.userId !== payload.sub) {
    throw ApiError.unauthorized('Session is no longer valid.', 'SESSION_REVOKED');
  }

  const matches = await verifyPassword(session.refreshTokenHash, refreshToken);
  if (!matches) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    throw ApiError.unauthorized('Refresh token is no longer valid.', 'SESSION_REVOKED');
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.deletedAt || user.status !== 'APPROVED') {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    throw ApiError.unauthorized('Account is not active.', 'ACCOUNT_INACTIVE');
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const newSession = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: '',
      deviceLabel: deviceLabel ?? session.deviceLabel ?? null,
    },
  });

  const tokens = issueTokens(
    { sub: user.id, role: user.role, sid: newSession.id },
    { sub: user.id, sid: newSession.id, v: 1 },
  );

  const refreshHash = await hashPassword(tokens.refreshToken);
  await prisma.session.update({
    where: { id: newSession.id },
    data: { refreshTokenHash: refreshHash, lastUsedAt: new Date() },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  };
}

export async function leaderAppointMember(
  leaderUserId: string,
  targetUserId: string,
) {
  if (leaderUserId === targetUserId) {
    throw ApiError.badRequest('You are already a leader.');
  }

  const leader = await prisma.user.findUnique({ where: { id: leaderUserId } });
  if (!leader || leader.deletedAt || leader.role !== 'LEADER') {
    throw ApiError.forbidden('Only choir leaders can appoint members.');
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.deletedAt) {
    throw ApiError.notFound('Member not found.');
  }
  if (target.status !== 'APPROVED') {
    throw ApiError.badRequest('Only approved members can be appointed as leaders.');
  }
  if (target.role === 'LEADER') {
    throw ApiError.conflict('This member is already a choir leader.');
  }
  if (target.role === 'ADMIN') {
    throw ApiError.forbidden('Cannot appoint an administrator as a leader.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUserId },
      data: { role: 'LEADER' },
    });

    const otherLeaders = await tx.user.findMany({
      where: {
        role: 'LEADER',
        status: 'APPROVED',
        deletedAt: null,
        id: { not: targetUserId },
      },
      select: { id: true },
    });

    const recipients = [
      targetUserId,
      ...otherLeaders.map((l) => l.id),
    ];
    await tx.notification.createMany({
      data: recipients.map((rid) => ({
        recipientId: rid,
        type: 'LEADERSHIP_CHANGE' as const,
        title: 'New Choir Leader',
        body: `${target.phone} has been appointed as a choir leader.`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })),
    });
  });

  return { ok: true as const };
}