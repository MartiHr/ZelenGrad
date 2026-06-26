import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createZone, listZones } from "../services/zones.service.js";
import { createZoneSchema } from "../validators/zones.schemas.js";

export const zonesRouter = Router();

zonesRouter.get("/", async (_request, response, next) => {
  try {
    response.json(await listZones());
  } catch (error) {
    next(error);
  }
});

zonesRouter.post(
  "/",
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  validateBody(createZoneSchema),
  async (request, response, next) => {
    try {
      response.status(201).json(await createZone(request.body));
    } catch (error) {
      next(error);
    }
  }
);
