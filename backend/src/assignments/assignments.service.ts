import { prisma } from '../db/prisma';
import { ApiError } from '../utils/ApiError';
import { ethFields } from '../utils/eth-fields';
import { ethTodayFromInstant, ethToUtcDate, EthDate } from '../utils/ethiopianCalendar';
import {
  GatheringType,
  AssignmentRole,
  AssignmentStatus,
  ReassignmentStatus,
} from '@prisma/client';

// ==========================================
// MEMBER SERVICES
// ==========================================

export async function getMyAssignments(userId: string) {
  const todayEth = ethTodayFromInstant(new Date());
  const todayUtc = ethToUtcDate(todayEth);

  const assignments = await prisma.serviceAssignment.findMany({
    where: {
      assignedUserId: userId,
      dateGregorian: { gte: todayUtc },
      status: AssignmentStatus.SCHEDULED,
    },
    orderBy: { dateGregorian: 'asc' },
    include: {
      assignedByUser: {
        select: {
          memberProfile: { select: { fullName: true, profilePhotoUrl: true } },
        },
      },
      reassignmentRequests: {
        where: { status: ReassignmentStatus.PENDING },
        select: { id: true, status: true, reason: true },
      },
    },
  });

  return assignments.map((a) => ({
    id: a.id,
    gatheringType: a.gatheringType,
    customGatheringName: a.customGatheringName,
    date: { year: a.dateEthYear, month: a.dateEthMonth, day: a.dateEthDay },
    role: a.role,
    status: a.status,
    assignedBy: a.assignedByUser.memberProfile?.fullName ?? 'Leader',
    assignedById: a.assignedByUserId,
    pendingRequest: a.reassignmentRequests[0] || null,
  }));
}

export async function requestReassignment(
  userId: string,
  assignmentId: string,
  reason: string,
) {
  if (!reason || reason.trim().length < 5) {
    throw ApiError.badRequest('A valid reason is required (min 5 characters).');
  }

  const assignment = await prisma.serviceAssignment.findUnique({
    where: { id: assignmentId },
    include: { assignedByUser: true },
  });

  if (!assignment) throw ApiError.notFound('Assignment not found.');
  if (assignment.assignedUserId !== userId) {
    throw ApiError.forbidden('You can only request reassignment for your own assignments.');
  }
  if (assignment.status === AssignmentStatus.CANCELLED) {
    throw ApiError.badRequest('This assignment has already been cancelled.');
  }

  const todayUtc = ethToUtcDate(ethTodayFromInstant(new Date()));
  if (assignment.dateGregorian < todayUtc) {
    throw ApiError.badRequest('Cannot request reassignment for a past event.');
  }

  const existing = await prisma.reassignmentRequest.findFirst({
    where: { assignmentId, status: ReassignmentStatus.PENDING },
  });
  if (existing) {
    throw ApiError.conflict('You already have a pending reassignment request for this assignment.');
  }

  const request = await prisma.$transaction(async (tx) => {
    const newRequest = await tx.reassignmentRequest.create({
      data: {
        assignmentId,
        requesterId: userId,
        reason: reason.trim(),
        status: ReassignmentStatus.PENDING,
      },
    });

    await tx.notification.create({
      data: {
        recipientId: assignment.assignedByUserId,
        type: 'REASSIGNMENT_UPDATE',
        title: 'New Reassignment Request',
        body: `A member requested reassignment for ${assignment.role} on ${assignment.dateEthMonth}/${assignment.dateEthDay}.`,
        relatedEntityType: 'ReassignmentRequest',
        relatedEntityId: newRequest.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return newRequest;
  });

  return request;
}

// ==========================================
// LEADER SERVICES
// ==========================================

export async function createAssignment(
  leaderId: string,
  data: {
    gatheringType: GatheringType;
    customGatheringName?: string;
    date: EthDate;
    role: AssignmentRole;
    assignedUserId: string;
  },
) {
  if (data.gatheringType === 'SPECIAL_EVENT' && !data.customGatheringName) {
    throw ApiError.badRequest('Custom gathering name is required for SPECIAL_EVENT.');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: data.assignedUserId },
  });
  if (!targetUser || targetUser.status !== 'APPROVED' || targetUser.deletedAt) {
    throw ApiError.badRequest('Assigned user must be an approved, active member.');
  }

  const dateGregorian = ethToUtcDate(data.date);

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      const newAssignment = await tx.serviceAssignment.create({
        data: {
          gatheringType: data.gatheringType,
          customGatheringName: data.customGatheringName,
          role: data.role,
          assignedUserId: data.assignedUserId,
          assignedByUserId: leaderId,
          ...(ethFields(data.date, 'date') as any),
        },
      });

      // 🟢 BROADCAST NOTIFICATION TO EVERYONE
      const allActiveUsers = await tx.user.findMany({
        where: { status: 'APPROVED', deletedAt: null },
        select: { id: true },
      });

      await tx.notification.createMany({
        data: allActiveUsers.map((u) => ({
          recipientId: u.id,
          type: 'SERVICE_ASSIGNMENT',
          title: 'New Service Assignment',
          body: `A new assignment has been scheduled for ${data.gatheringType.replace('_', ' ')} on ${data.date.month}/${data.date.day}.`,
          relatedEntityType: 'ServiceAssignment',
          relatedEntityId: newAssignment.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })),
      });

      return newAssignment;
    });

    return assignment;
  } catch (err: any) {
    if (err.code === 'P2002') {
      throw ApiError.conflict(`Another member is already assigned as ${data.role.replace('_', ' ')} for this gathering and date.`);
    }
    throw err;
  }
}

export async function getLeaderAssignments() {
  const todayEth = ethTodayFromInstant(new Date());
  
  // Calculate 2 months ago for history
  const twoMonthsAgoEth = { ...todayEth };
  twoMonthsAgoEth.month -= 2;
  if (twoMonthsAgoEth.month <= 0) {
    twoMonthsAgoEth.month += 13;
    twoMonthsAgoEth.year -= 1;
  }
  const twoMonthsAgoUtc = ethToUtcDate(twoMonthsAgoEth);

  // Get assignments from the last 2 months (including upcoming)
  const assignments = await prisma.serviceAssignment.findMany({
    where: { dateGregorian: { gte: twoMonthsAgoUtc } },
    orderBy: { dateGregorian: 'desc' }, // Most recent/upcoming first
    include: {
      assignedUser: {
        select: { id: true, memberProfile: { select: { fullName: true, profilePhotoUrl: true } } },
      },
      assignedByUser: {
         select: { memberProfile: { select: { fullName: true } } }
      }
    },
  });

  const requests = await prisma.reassignmentRequest.findMany({
    where: { status: ReassignmentStatus.PENDING },
    orderBy: { createdAt: 'desc' },
    include: {
      requester: { select: { id: true, memberProfile: { select: { fullName: true } } } },
      assignment: true,
    },
  });

  return { assignments, requests };
}

export async function resolveReassignment(
  leaderId: string,
  requestId: string,
  status: 'APPROVED' | 'REJECTED',
) {
  const request = await prisma.reassignmentRequest.findUnique({
    where: { id: requestId },
    include: { assignment: true },
  });

  if (!request) throw ApiError.notFound('Request not found.');
  if (request.status !== ReassignmentStatus.PENDING) {
    throw ApiError.badRequest('This request has already been resolved.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.reassignmentRequest.update({
      where: { id: requestId },
      data: {
        status,
        resolvedByUserId: leaderId,
        resolvedAt: new Date(),
      },
    });

    if (status === 'APPROVED') {
      await tx.serviceAssignment.update({
        where: { id: request.assignmentId },
        data: { status: AssignmentStatus.CANCELLED },
      });
    }

    await tx.notification.create({
      data: {
        recipientId: request.requesterId,
        type: 'REASSIGNMENT_UPDATE',
        title: `Reassignment Request ${status}`,
        body: status === 'APPROVED'
          ? `Your request to be reassigned from ${request.assignment.role} was approved.`
          : `Your request to be reassigned from ${request.assignment.role} was rejected.`,
        relatedEntityType: 'ServiceAssignment',
        relatedEntityId: request.assignmentId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return updatedRequest;
  });

  return result;
}

export async function cancelAssignment(leaderId: string, assignmentId: string) {
  const assignment = await prisma.serviceAssignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) throw ApiError.notFound('Assignment not found.');
  if (assignment.status === AssignmentStatus.CANCELLED) {
    throw ApiError.badRequest('Assignment is already cancelled.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const a = await tx.serviceAssignment.update({
      where: { id: assignmentId },
      data: { status: AssignmentStatus.CANCELLED },
    });

    await tx.notification.create({
      data: {
        recipientId: a.assignedUserId,
        type: 'SERVICE_ASSIGNMENT',
        title: 'Assignment Cancelled',
        body: `Your assignment as ${a.role.replace('_', ' ')} has been cancelled by a leader.`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return a;
  });

  return updated;
}