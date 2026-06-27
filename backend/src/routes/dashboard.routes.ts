import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateQuery } from "../middleware/validateQuery.js";
import { getDashboardSummary } from "../services/dashboard.service.js";
import { dashboardSummaryQuerySchema } from "../validators/dashboard.schemas.js";
import type { DashboardSummaryQuery } from "../validators/dashboard.schemas.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/summary",
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  validateQuery(dashboardSummaryQuerySchema),
  async (_request, response, next) => {
    try {
      response.json(await getDashboardSummary(response.locals.validatedQuery as DashboardSummaryQuery));
    } catch (error) {
      next(error);
    }
  }
);
