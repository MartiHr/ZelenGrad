import { MaintenanceTaskStatus, type Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { sseHub } from "../realtime/sseHub.js";
import type {
  CreateMaintenanceTaskInput,
  ListMaintenanceQuery,
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

export const listMaintenanceTasks = async (query: ListMaintenanceQuery, currentUserId: string, canViewAll: boolean) => {
  return prisma.maintenanceTask.findMany({
    where: {
      status: query.status,
      assignedToId: canViewAll ? query.assignedToId : currentUserId,
      assetId: query.assetId,
      zoneId: query.zoneId
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

  if (!canViewAll && task.assignedToId !== currentUserId) {
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

export const updateMaintenanceTaskStatus = async (
  taskId: string,
  input: UpdateMaintenanceStatusInput,
  completedById: string
) => {
  const existingTask = await getMaintenanceTaskById(taskId);
  const completedAt = input.status === MaintenanceTaskStatus.COMPLETED ? new Date() : null;

  const task = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.maintenanceTask.update({
      where: { id: taskId },
      data: {
        status: input.status,
        completedById: input.status === MaintenanceTaskStatus.COMPLETED ? completedById : null,
        completedAt
      },
      include: taskDetailInclude
    });

    if (input.status === MaintenanceTaskStatus.COMPLETED) {
      await tx.maintenanceLog.create({
        data: {
          taskId,
          assetId: existingTask.assetId,
          employeeId: completedById,
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
