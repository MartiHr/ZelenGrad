import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { validateQuery } from "../middleware/validateQuery.js";
import { createIncident, listIncidents, updateIncident } from "../services/incidents.service.js";
import {
  createIncidentSchema,
  listIncidentsQuerySchema,
  updateIncidentSchema
} from "../validators/incidents.schemas.js";
import type { ListIncidentsQuery } from "../validators/incidents.schemas.js";

export const incidentsRouter = Router();

const reviewerRoles = [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.ADMIN];
const reporterRoles = [UserRole.CITIZEN, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.ADMIN];

incidentsRouter.get(
  "/",
  requireAuth,
  requireRole(...reviewerRoles),
  validateQuery(listIncidentsQuerySchema),
  async (_request, response, next) => {
    try {
      response.json(await listIncidents(response.locals.validatedQuery as ListIncidentsQuery));
    } catch (error) {
      next(error);
    }
  }
);

incidentsRouter.post(
  "/",
  requireAuth,
  requireRole(...reporterRoles),
  validateBody(createIncidentSchema),
  async (request, response, next) => {
    try {
      response.status(201).json(await createIncident(request.body, request.user!.id));
    } catch (error) {
      next(error);
    }
  }
);

incidentsRouter.put(
  "/:incidentId",
  requireAuth,
  requireRole(...reviewerRoles),
  validateBody(updateIncidentSchema),
  async (request, response, next) => {
    try {
      const { incidentId } = request.params;

      if (typeof incidentId !== "string") {
        response.status(400).json({ error: "Validation Error", message: "Incident id is required." });
        return;
      }

      response.json(await updateIncident(incidentId, request.body, request.user!.id));
    } catch (error) {
      next(error);
    }
  }
);
