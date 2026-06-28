import { UserRole, type Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import type { CreateZoneInput, ZoneAssignmentInput } from "../validators/zones.schemas.js";
import { AppError } from "./users.service.js";

const zoneInclude = {
  _count: {
    select: {
      assets: true,
      tasks: true,
      incidents: true,
      assignments: true
    }
  }
} satisfies Prisma.ZoneInclude;

const zoneManagementInclude = {
  ...zoneInclude,
  assignments: {
    orderBy: {
      assignedAt: "desc"
    },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  }
} satisfies Prisma.ZoneInclude;

export const listZones = async () => {
  return prisma.zone.findMany({
    orderBy: { name: "asc" },
    include: zoneInclude
  });
};

export const listManagedZones = async () => {
  return prisma.zone.findMany({
    orderBy: { name: "asc" },
    include: zoneManagementInclude
  });
};

export const listAssignedZones = async (employeeId: string) => {
  return prisma.zone.findMany({
    where: {
      assignments: {
        some: { employeeId }
      }
    },
    orderBy: { name: "asc" },
    include: zoneManagementInclude
  });
};

export const getManagedZoneById = async (zoneId: string) => {
  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    include: zoneManagementInclude
  });

  if (!zone) {
    throw new AppError(404, "Zone not found.");
  }

  return zone;
};

export const createZone = async (input: CreateZoneInput) => {
  const { boundary, ...zoneInput } = input;

  return prisma.zone.create({
    data: {
      ...zoneInput,
      boundary: boundary === undefined ? undefined : (boundary as Prisma.InputJsonValue)
    },
    include: zoneManagementInclude
  });
};

export const assignEmployeeToZone = async (zoneId: string, input: ZoneAssignmentInput) => {
  await getManagedZoneById(zoneId);

  const employee = await prisma.user.findUnique({
    where: { id: input.employeeId },
    select: {
      id: true,
      isActive: true,
      role: true
    }
  });

  if (!employee || !employee.isActive) {
    throw new AppError(404, "Active staff user not found.");
  }

  const assignableRoles: UserRole[] = [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.ADMIN];

  if (!assignableRoles.includes(employee.role)) {
    throw new AppError(400, "Only staff users can be assigned to zones.");
  }

  await prisma.zoneAssignment.upsert({
    where: {
      zoneId_employeeId: {
        zoneId,
        employeeId: input.employeeId
      }
    },
    update: {},
    create: {
      zoneId,
      employeeId: input.employeeId
    }
  });

  return getManagedZoneById(zoneId);
};

export const removeEmployeeFromZone = async (zoneId: string, employeeId: string) => {
  await getManagedZoneById(zoneId);

  await prisma.zoneAssignment.deleteMany({
    where: {
      zoneId,
      employeeId
    }
  });

  return getManagedZoneById(zoneId);
};
