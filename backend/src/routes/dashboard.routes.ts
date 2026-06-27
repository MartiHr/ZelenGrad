import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { getDashboardSummary } from "../services/dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/summary",
  requireAuth,
  requireRole(UserRole.MANAGER, UserRole.ADMIN),
  async (_request, response, next) => {
    try {
      response.json(await getDashboardSummary());
    } catch (error) {
      next(error);
    }
  }
);
