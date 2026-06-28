import { IncidentStatus, RewardReason, type Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { sseHub } from "../realtime/sseHub.js";
import type {
  CreateIncidentInput,
  ListIncidentsQuery,
  UpdateIncidentInput
} from "../validators/incidents.schemas.js";
import { AppError } from "./users.service.js";

const incidentReportedPoints = 2;
const incidentVerifiedPoints = 8;

const incidentInclude = {
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  reporter: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  verifiedBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  asset: {
    select: {
      id: true,
      commonName: true,
      species: true,
      healthStatus: true
    }
  },
  zone: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.IncidentReportInclude;

const buildResponsibleZoneFilter = (employeeId: string): Prisma.IncidentReportWhereInput => ({
  OR: [
    {
      zone: {
        assignments: {
          some: { employeeId }
        }
      }
    },
    {
      asset: {
        zone: {
          assignments: {
            some: { employeeId }
          }
        }
      }
    }
  ]
});

const getNextIncidentStatuses = (status: IncidentStatus): IncidentStatus[] => {
  switch (status) {
    case IncidentStatus.REPORTED:
      return [IncidentStatus.VERIFIED, IncidentStatus.REJECTED];
    case IncidentStatus.VERIFIED:
      return [IncidentStatus.IN_PROGRESS, IncidentStatus.REJECTED, IncidentStatus.REPORTED];
    case IncidentStatus.IN_PROGRESS:
      return [IncidentStatus.RESOLVED, IncidentStatus.REJECTED, IncidentStatus.VERIFIED];
    case IncidentStatus.RESOLVED:
    case IncidentStatus.REJECTED:
      return [IncidentStatus.REPORTED];
    default:
      return [];
  }
};

export const listIncidents = async (query: ListIncidentsQuery, currentUserId: string, canViewAll: boolean) => {
  const responsibilityFilter =
    canViewAll && query.responsibleEmployeeId ? buildResponsibleZoneFilter(query.responsibleEmployeeId) : {};
  const reviewerScopeFilter = !canViewAll ? buildResponsibleZoneFilter(currentUserId) : {};

  return prisma.incidentReport.findMany({
    where: {
      AND: [
        {
          status: query.status,
          priority: query.priority,
          assetId: query.assetId,
          zoneId: query.zoneId
        },
        responsibilityFilter,
        reviewerScopeFilter
      ]
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: incidentInclude
  });
};

export const getIncidentById = async (incidentId: string) => {
  const incident = await prisma.incidentReport.findUnique({
    where: { id: incidentId },
    include: incidentInclude
  });

  if (!incident) {
    throw new AppError(404, "Incident report not found.");
  }

  return incident;
};

export const createIncident = async (input: CreateIncidentInput, reporterId: string) => {
  const incident = await prisma.$transaction(async (transaction) => {
    const createdIncident = await transaction.incidentReport.create({
      data: {
        ...input,
        reporterId
      },
      include: incidentInclude
    });

    await transaction.user.update({
      where: { id: reporterId },
      data: { greenPoints: { increment: incidentReportedPoints } }
    });

    await transaction.rewardTransaction.create({
      data: {
        userId: reporterId,
        points: incidentReportedPoints,
        reason: RewardReason.INCIDENT_REPORTED,
        description: `Reported incident ${createdIncident.title}.`
      }
    });

    return createdIncident;
  });

  sseHub.broadcast("incident.created", {
    incidentId: incident.id,
    title: incident.title,
    priority: incident.priority,
    status: incident.status,
    createdAt: incident.createdAt
  });

  return incident;
};

export const getIncidentForUser = async (incidentId: string, currentUserId: string, canViewAll: boolean) => {
  const incident = await getIncidentById(incidentId);

  if (canViewAll) {
    return incident;
  }

  const responsibleIncidentCount = await prisma.incidentReport.count({
    where: {
      id: incidentId,
      ...buildResponsibleZoneFilter(currentUserId)
    }
  });

  if (responsibleIncidentCount === 0) {
    throw new AppError(403, "You do not have access to this incident report.");
  }

  return incident;
};

export const updateIncident = async (
  incidentId: string,
  input: UpdateIncidentInput,
  verifierId: string,
  canViewAll: boolean
) => {
  const existingIncident = await getIncidentForUser(incidentId, verifierId, canViewAll);
  const nextStatus = input.status;

  if (nextStatus && nextStatus !== existingIncident.status) {
    const allowedStatuses = getNextIncidentStatuses(existingIncident.status);

    if (!allowedStatuses.includes(nextStatus)) {
      throw new AppError(409, `Cannot move incident from ${existingIncident.status} to ${nextStatus}.`);
    }
  }

  const shouldMarkReviewed =
    nextStatus === IncidentStatus.VERIFIED ||
    nextStatus === IncidentStatus.IN_PROGRESS ||
    nextStatus === IncidentStatus.RESOLVED ||
    nextStatus === IncidentStatus.REJECTED;
  const shouldAwardEligible =
    nextStatus === IncidentStatus.VERIFIED ||
    nextStatus === IncidentStatus.IN_PROGRESS ||
    nextStatus === IncidentStatus.RESOLVED;
  const shouldClearReview = nextStatus === IncidentStatus.REPORTED;
  const shouldResolve = nextStatus === IncidentStatus.RESOLVED;
  const shouldAwardVerification = shouldAwardEligible && !existingIncident.verifiedAt && Boolean(existingIncident.reporterId);

  const incident = await prisma.$transaction(async (transaction) => {
    const updatedIncident = await transaction.incidentReport.update({
      where: { id: incidentId },
      data: {
        ...input,
        verifiedById: shouldClearReview ? null : shouldMarkReviewed ? verifierId : undefined,
        verifiedAt: shouldClearReview ? null : shouldMarkReviewed ? (existingIncident.verifiedAt ?? new Date()) : undefined,
        resolvedAt: nextStatus ? (shouldResolve ? (existingIncident.resolvedAt ?? new Date()) : null) : undefined
      },
      include: incidentInclude
    });

    if (shouldAwardVerification) {
      const reporterId = existingIncident.reporterId!;

      await transaction.user.update({
        where: { id: reporterId },
        data: { greenPoints: { increment: incidentVerifiedPoints } }
      });

      await transaction.rewardTransaction.create({
        data: {
          userId: reporterId,
          points: incidentVerifiedPoints,
          reason: RewardReason.INCIDENT_VERIFIED,
          description: `Incident verified: ${updatedIncident.title}.`
        }
      });
    }

    return updatedIncident;
  });

  sseHub.broadcast("incident.updated", {
    incidentId: incident.id,
    title: incident.title,
    priority: incident.priority,
    status: incident.status,
    updatedAt: incident.updatedAt
  });

  return incident;
};
