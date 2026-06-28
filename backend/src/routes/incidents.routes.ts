import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { validateQuery } from "../middleware/validateQuery.js";
import { createIncident, getIncidentForUser, listIncidents, updateIncident } from "../services/incidents.service.js";
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
  async (request, response, next) => {
    try {
      const canViewAll = request.user!.role === UserRole.MANAGER || request.user!.role === UserRole.ADMIN;
      response.json(
        await listIncidents(response.locals.validatedQuery as ListIncidentsQuery, request.user!.id, canViewAll)
      );
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

incidentsRouter.get(
  "/:incidentId",
  requireAuth,
  requireRole(...reviewerRoles),
  async (request, response, next) => {
    try {
      const { incidentId } = request.params;

      if (typeof incidentId !== "string") {
        response.status(400).json({ error: "Validation Error", message: "Incident id is required." });
        return;
      }

      const canViewAll = request.user!.role === UserRole.MANAGER || request.user!.role === UserRole.ADMIN;
      response.json(await getIncidentForUser(incidentId, request.user!.id, canViewAll));
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

      const canViewAll = request.user!.role === UserRole.MANAGER || request.user!.role === UserRole.ADMIN;
      response.json(await updateIncident(incidentId, request.body, request.user!.id, canViewAll));
    } catch (error) {
      next(error);
    }
  }
);
