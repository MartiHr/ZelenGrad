import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { getAuditOverview } from "../services/audit.service.js";

export const auditRouter = Router();

auditRouter.get(
  "/overview",
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (_request, response, next) => {
    try {
      response.json(await getAuditOverview());
    } catch (error) {
      next(error);
    }
  }
);
