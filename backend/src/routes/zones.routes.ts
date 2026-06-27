import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  assignEmployeeToZone,
  createZone,
  listManagedZones,
  listZones,
  removeEmployeeFromZone
} from "../services/zones.service.js";
import { createZoneSchema, zoneAssignmentSchema } from "../validators/zones.schemas.js";

export const zonesRouter = Router();
const managerRoles = [UserRole.MANAGER, UserRole.ADMIN];

zonesRouter.get("/", async (_request, response, next) => {
  try {
    response.json(await listZones());
  } catch (error) {
    next(error);
  }
});

zonesRouter.get(
  "/management",
  requireAuth,
  requireRole(...managerRoles),
  async (_request, response, next) => {
    try {
      response.json(await listManagedZones());
    } catch (error) {
      next(error);
    }
  }
);

zonesRouter.post(
  "/",
  requireAuth,
  requireRole(...managerRoles),
  validateBody(createZoneSchema),
  async (request, response, next) => {
    try {
      response.status(201).json(await createZone(request.body));
    } catch (error) {
      next(error);
    }
  }
);

zonesRouter.post(
  "/:zoneId/assignments",
  requireAuth,
  requireRole(...managerRoles),
  validateBody(zoneAssignmentSchema),
  async (request, response, next) => {
    try {
      const { zoneId } = request.params;

      if (typeof zoneId !== "string") {
        response.status(400).json({ error: "Validation Error", message: "Zone id is required." });
        return;
      }

      response.json(await assignEmployeeToZone(zoneId, request.body));
    } catch (error) {
      next(error);
    }
  }
);

zonesRouter.delete(
  "/:zoneId/assignments/:employeeId",
  requireAuth,
  requireRole(...managerRoles),
  async (request, response, next) => {
    try {
      const { zoneId, employeeId } = request.params;

      if (typeof zoneId !== "string" || typeof employeeId !== "string") {
        response.status(400).json({ error: "Validation Error", message: "Zone id and employee id are required." });
        return;
      }

      response.json(await removeEmployeeFromZone(zoneId, employeeId));
    } catch (error) {
      next(error);
    }
  }
);
