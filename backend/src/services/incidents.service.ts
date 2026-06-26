import { IncidentStatus, type Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { sseHub } from "../realtime/sseHub.js";
import type {
  CreateIncidentInput,
  ListIncidentsQuery,
  UpdateIncidentInput
} from "../validators/incidents.schemas.js";
import { AppError } from "./users.service.js";

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
  const incident = await prisma.incidentReport.create({
    data: {
      ...input,
      reporterId
    },
    include: incidentInclude
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
  await getIncidentById(incidentId);

  const shouldMarkVerified =
    input.status === IncidentStatus.VERIFIED ||
    input.status === IncidentStatus.IN_PROGRESS ||
    input.status === IncidentStatus.RESOLVED;

  const incident = await prisma.incidentReport.update({
    where: { id: incidentId },
    data: {
      ...input,
      verifiedById: shouldMarkVerified ? verifierId : undefined,
      verifiedAt: shouldMarkVerified ? new Date() : undefined,
      resolvedAt: input.status === IncidentStatus.RESOLVED ? new Date() : undefined
    },
    include: incidentInclude
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
