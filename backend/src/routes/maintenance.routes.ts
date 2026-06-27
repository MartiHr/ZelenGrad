import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { validateQuery } from "../middleware/validateQuery.js";
import {
  createMaintenanceTask,
  getMaintenanceTaskForUser,
  listMaintenanceTasks,
  updateMaintenanceTaskStatus
} from "../services/maintenance.service.js";
import {
  createMaintenanceTaskSchema,
  listMaintenanceQuerySchema,
  updateMaintenanceStatusSchema
} from "../validators/maintenance.schemas.js";
import type { ListMaintenanceQuery } from "../validators/maintenance.schemas.js";

export const maintenanceRouter = Router();

const workerRoles = [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.ADMIN];
const managerRoles = [UserRole.MANAGER, UserRole.ADMIN];

maintenanceRouter.get(
  "/",
  requireAuth,
  requireRole(...workerRoles),
  validateQuery(listMaintenanceQuerySchema),
  async (request, response, next) => {
    try {
      const canViewAll = request.user!.role === UserRole.MANAGER || request.user!.role === UserRole.ADMIN;
      response.json(
        await listMaintenanceTasks(response.locals.validatedQuery as ListMaintenanceQuery, request.user!.id, canViewAll)
      );
    } catch (error) {
      next(error);
    }
  }
);

maintenanceRouter.post(
  "/",
  requireAuth,
  requireRole(...managerRoles),
  validateBody(createMaintenanceTaskSchema),
  async (request, response, next) => {
    try {
      response.status(201).json(await createMaintenanceTask(request.body, request.user!.id));
    } catch (error) {
      next(error);
    }
  }
);

maintenanceRouter.get(
  "/:taskId",
  requireAuth,
  requireRole(...workerRoles),
  async (request, response, next) => {
    try {
      const { taskId } = request.params;

      if (typeof taskId !== "string") {
        response.status(400).json({ error: "Validation Error", message: "Task id is required." });
        return;
      }

      const canViewAll = request.user!.role === UserRole.MANAGER || request.user!.role === UserRole.ADMIN;
      response.json(await getMaintenanceTaskForUser(taskId, request.user!.id, canViewAll));
    } catch (error) {
      next(error);
    }
  }
);

maintenanceRouter.patch(
  "/:taskId/status",
  requireAuth,
  requireRole(...workerRoles),
  validateBody(updateMaintenanceStatusSchema),
  async (request, response, next) => {
    try {
      const { taskId } = request.params;

      if (typeof taskId !== "string") {
        response.status(400).json({ error: "Validation Error", message: "Task id is required." });
        return;
      }

      response.json(await updateMaintenanceTaskStatus(taskId, request.body, request.user!.id));
    } catch (error) {
      next(error);
    }
  }
);
