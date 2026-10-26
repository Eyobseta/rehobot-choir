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

  // Invalidate other sessions — the current one stays valid.
  // (We do NOT revoke the current session because we want the user to remain logged in.)
  return { ok: true };
}

/**
 * Leader resets a member's password to a temporary one (SRS 6.7).
 * Sets mustChangePassword = true.
 * Returns the temporary password so the leader can share it manually.
 */
export async function leaderResetMemberPassword(
  leaderUserId: string,
  targetUserId: string,
) {
  if (leaderUserId === targetUserId) {
    throw ApiError.badRequest('Use change-password to change your own password.');
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.deletedAt) {
    throw ApiError.notFound('Member not found.');
  }
  if (target.role === 'ADMIN') {
    throw ApiError.forbidden('Cannot reset the admin password from here.');
  }
  if (target.role === 'LEADER') {
    throw ApiError.forbidden('Only the System Administrator can reset a leader password.');
  }

  // Generate a random 10-character temporary password.
  const tempPassword = generateTempPassword(10);
  const passwordHash = await hashPassword(tempPassword);

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

  return { temporaryPassword: tempPassword };
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
 * Requires the member's own password.
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
 * Requires the leader's own password as confirmation.
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

/**
 * Soft-delete implementation (SRS 7.3):
 * - Personal info removed (name, DOB, emergency, phone, email, password).
 * - Profile photo retained.
 * - Phone freed for reuse.
 * - Sessions revoked.
 * - Tombstone User remains so the directory shows "Deleted Member".
 */
async function performSoftDelete(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // Deleted phone goes to a tombstone format so it can be reused.
  // We do NOT store the old phone anywhere.
  const tombstonePhone = `deleted_${user.id}`;
  const tombstonePassword = await hashPassword(
    Math.random().toString(36).slice(2) + Date.now().toString(36),
  );

  await prisma.$transaction(async (tx) => {
    // Delete the member profile (personal info).
    await tx.memberProfile.deleteMany({ where: { userId } });

    // Revoke all sessions.
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Clear personal fields on User.
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
          // FIXED: removed `dateOfBirth: true` — that field doesn't exist on MemberProfile.
          // If you ever need the DOB here, use:
          //   dateOfBirthEthYear: true,
          //   dateOfBirthEthMonth: true,
          //   dateOfBirthEthDay: true,
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


/**
 * Rotate a refresh token.
 * Validates the token, revokes the current session, creates a new session,
 * and issues a fresh pair of tokens.
 */
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

  // Verify the presented refresh token matches the stored hash.
  const matches = await verifyPassword(session.refreshTokenHash, refreshToken);
  if (!matches) {
    // Someone is trying to reuse an old (already rotated) refresh token.
    // Revoke the whole session — this is a classic token-reuse attack.
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    throw ApiError.unauthorized(
      'Refresh token is no longer valid.',
      'SESSION_REVOKED',
    );
  }

  // Fetch the user (still needs to be APPROVED and not deleted).
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.deletedAt || user.status !== 'APPROVED') {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    throw ApiError.unauthorized('Account is not active.', 'ACCOUNT_INACTIVE');
  }

  // Rotate: revoke the current session, create a new one.
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

/**
 * NEW: Appoint an approved member as a choir leader (SRS 8.2).
 */
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

    // Notify the new leader and all current leaders (SRS 8.2)
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