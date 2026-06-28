import { MaintenanceTaskStatus, type Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { sseHub } from "../realtime/sseHub.js";
import type {
  CreateMaintenanceTaskInput,
  ListMaintenanceQuery,
  UpdateMaintenanceTaskInput,
  UpdateMaintenanceStatusInput
} from "../validators/maintenance.schemas.js";
import { AppError } from "./users.service.js";

const taskInclude = {
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
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  completedBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  }
} satisfies Prisma.MaintenanceTaskInclude;

const taskDetailInclude = {
  ...taskInclude,
  logs: {
    orderBy: {
      performedAt: "desc"
    },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  }
} satisfies Prisma.MaintenanceTaskInclude;

const buildResponsibleZoneFilter = (employeeId: string): Prisma.MaintenanceTaskWhereInput => ({
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

const buildEmployeeWorklistFilter = (
  employeeId: string,
  responsibleZoneOnly?: boolean
): Prisma.MaintenanceTaskWhereInput => {
  if (responsibleZoneOnly) {
    return buildResponsibleZoneFilter(employeeId);
  }

  return {
    OR: [
      { assignedToId: employeeId },
      {
        AND: [{ assignedToId: null }, buildResponsibleZoneFilter(employeeId)]
      }
    ]
  };
};

const getNextMaintenanceStatuses = (status: MaintenanceTaskStatus): MaintenanceTaskStatus[] => {
  switch (status) {
    case MaintenanceTaskStatus.PLANNED:
      return [MaintenanceTaskStatus.ASSIGNED, MaintenanceTaskStatus.IN_PROGRESS, MaintenanceTaskStatus.CANCELLED];
    case MaintenanceTaskStatus.ASSIGNED:
      return [MaintenanceTaskStatus.IN_PROGRESS, MaintenanceTaskStatus.COMPLETED, MaintenanceTaskStatus.CANCELLED];
    case MaintenanceTaskStatus.IN_PROGRESS:
      return [MaintenanceTaskStatus.COMPLETED, MaintenanceTaskStatus.CANCELLED];
    case MaintenanceTaskStatus.COMPLETED:
    case MaintenanceTaskStatus.CANCELLED:
      return [];
    default:
      return [];
  }
};

export const listMaintenanceTasks = async (query: ListMaintenanceQuery, currentUserId: string, canViewAll: boolean) => {
  const visibilityFilter: Prisma.MaintenanceTaskWhereInput = canViewAll
    ? {}
    : buildEmployeeWorklistFilter(currentUserId, query.responsibleZoneOnly);
  const responsibilityFilter =
    canViewAll && query.responsibleEmployeeId ? buildResponsibleZoneFilter(query.responsibleEmployeeId) : {};

  return prisma.maintenanceTask.findMany({
    where: {
      AND: [
        {
          status: query.status,
          assignedToId: canViewAll ? query.assignedToId : undefined,
          assetId: query.assetId,
          zoneId: query.zoneId
        },
        visibilityFilter,
        responsibilityFilter
      ]
    },
    orderBy: [{ dueAt: "asc" }, { scheduledFor: "asc" }, { createdAt: "desc" }],
    include: taskInclude
  });
};

export const getMaintenanceTaskById = async (taskId: string) => {
  const task = await prisma.maintenanceTask.findUnique({
    where: { id: taskId },
    include: taskDetailInclude
  });

  if (!task) {
    throw new AppError(404, "Maintenance task not found.");
  }

  return task;
};

export const getMaintenanceTaskForUser = async (taskId: string, currentUserId: string, canViewAll: boolean) => {
  const task = await getMaintenanceTaskById(taskId);

  if (canViewAll || task.assignedToId === currentUserId) {
    return task;
  }

  const responsibleZoneTaskCount = await prisma.maintenanceTask.count({
    where: {
      id: taskId,
      ...buildResponsibleZoneFilter(currentUserId)
    }
  });

  if (responsibleZoneTaskCount === 0) {
    throw new AppError(403, "You do not have access to this maintenance task.");
  }

  return task;
};

export const createMaintenanceTask = async (input: CreateMaintenanceTaskInput, createdById: string) => {
  const task = await prisma.maintenanceTask.create({
    data: {
      ...input,
      createdById,
      status: input.assignedToId && input.status === MaintenanceTaskStatus.PLANNED ? MaintenanceTaskStatus.ASSIGNED : input.status
    },
    include: taskInclude
  });

  sseHub.broadcast("maintenance.updated", {
    taskId: task.id,
    title: task.title,
    status: task.status,
    action: "created",
    updatedAt: task.updatedAt
  });

  return task;
};

export const updateMaintenanceTask = async (taskId: string, input: UpdateMaintenanceTaskInput) => {
  const existingTask = await getMaintenanceTaskById(taskId);
  const nextAssetId = input.assetId === undefined ? existingTask.assetId : input.assetId;
  const nextZoneId = input.zoneId === undefined ? existingTask.zoneId : input.zoneId;

  if (!nextAssetId && !nextZoneId) {
    throw new AppError(400, "A maintenance task must target either an asset or a zone.");
  }

  const task = await prisma.maintenanceTask.update({
    where: { id: taskId },
    data: {
      ...input,
      status:
        input.assignedToId && existingTask.status === MaintenanceTaskStatus.PLANNED
          ? MaintenanceTaskStatus.ASSIGNED
          : undefined
    },
    include: taskDetailInclude
  });

  sseHub.broadcast("maintenance.updated", {
    taskId: task.id,
    title: task.title,
    status: task.status,
    action: "updated",
    updatedAt: task.updatedAt
  });

  return task;
};

export const updateMaintenanceTaskStatus = async (
  taskId: string,
  input: UpdateMaintenanceStatusInput,
  currentUserId: string,
  canViewAll: boolean
) => {
  const existingTask = await getMaintenanceTaskForUser(taskId, currentUserId, canViewAll);
  const nextStatuses = getNextMaintenanceStatuses(existingTask.status);

  if (!nextStatuses.includes(input.status)) {
    throw new AppError(409, `Cannot move maintenance task from ${existingTask.status} to ${input.status}.`);
  }

  if (input.status === MaintenanceTaskStatus.COMPLETED && !input.notes && !input.resultingHealth) {
    throw new AppError(400, "Completion notes or resulting health is required to complete a task.");
  }

  const completedAt = input.status === MaintenanceTaskStatus.COMPLETED ? new Date() : null;

  const task = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.maintenanceTask.update({
      where: { id: taskId },
      data: {
        status: input.status,
        completedById: input.status === MaintenanceTaskStatus.COMPLETED ? currentUserId : null,
        completedAt
      },
      include: taskDetailInclude
    });

    if (input.status === MaintenanceTaskStatus.COMPLETED) {
      await tx.maintenanceLog.create({
        data: {
          taskId,
          assetId: existingTask.assetId,
          employeeId: currentUserId,
          notes: input.notes,
          resultingHealth: input.resultingHealth
        }
      });

      if (existingTask.assetId && input.resultingHealth) {
        await tx.greenAsset.update({
          where: { id: existingTask.assetId },
          data: { healthStatus: input.resultingHealth }
        });

        await tx.assetHealthLog.create({
          data: {
            assetId: existingTask.assetId,
            status: input.resultingHealth,
            source: "maintenance",
            notes: input.notes
          }
        });
      }
    }

    return updatedTask;
  });

  sseHub.broadcast("maintenance.updated", {
    taskId: task.id,
    title: task.title,
    status: task.status,
    action: "status_updated",
    updatedAt: task.updatedAt
  });

  return task;
};
