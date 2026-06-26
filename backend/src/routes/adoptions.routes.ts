import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createAdoption, createCareLog, listMyAdoptions } from "../services/adoptions.service.js";
import { createAdoptionSchema, createCareLogSchema } from "../validators/adoptions.schemas.js";

export const adoptionsRouter = Router();

adoptionsRouter.get(
  "/me",
  requireAuth,
  requireRole(UserRole.CITIZEN),
  async (request, response, next) => {
    try {
      response.json(await listMyAdoptions(request.user!.id));
    } catch (error) {
      next(error);
    }
  }
);

adoptionsRouter.post(
  "/",
  requireAuth,
  requireRole(UserRole.CITIZEN),
  validateBody(createAdoptionSchema),
  async (request, response, next) => {
    try {
      response.status(201).json(await createAdoption(request.user!.id, request.body));
    } catch (error) {
      next(error);
    }
  }
);

adoptionsRouter.post(
  "/:adoptionId/care-logs",
  requireAuth,
  requireRole(UserRole.CITIZEN),
  validateBody(createCareLogSchema),
  async (request, response, next) => {
    try {
      const { adoptionId } = request.params;

      if (typeof adoptionId !== "string") {
        response.status(400).json({ error: "Validation Error", message: "Adoption id is required." });
        return;
      }

      response.status(201).json(await createCareLog(request.user!.id, adoptionId, request.body));
    } catch (error) {
      next(error);
    }
  }
);
