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

export const listIncidents = async (query: ListIncidentsQuery) => {
  return prisma.incidentReport.findMany({
    where: {
      status: query.status,
      priority: query.priority,
      assetId: query.assetId,
      zoneId: query.zoneId
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

export const updateIncident = async (incidentId: string, input: UpdateIncidentInput, verifierId: string) => {
  const existingIncident = await getIncidentById(incidentId);

  const shouldMarkVerified =
    input.status === IncidentStatus.VERIFIED ||
    input.status === IncidentStatus.IN_PROGRESS ||
    input.status === IncidentStatus.RESOLVED;
  const shouldAwardVerification = shouldMarkVerified && !existingIncident.verifiedAt && Boolean(existingIncident.reporterId);

  const incident = await prisma.$transaction(async (transaction) => {
    const updatedIncident = await transaction.incidentReport.update({
      where: { id: incidentId },
      data: {
        ...input,
        verifiedById: shouldMarkVerified ? verifierId : undefined,
        verifiedAt: shouldMarkVerified ? new Date() : undefined,
        resolvedAt: input.status === IncidentStatus.RESOLVED ? new Date() : undefined
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
