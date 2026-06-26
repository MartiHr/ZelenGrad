import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { validateQuery } from "../middleware/validateQuery.js";
import { adjustRewards, listMyRewards, listRewards } from "../services/rewards.service.js";
import { adjustRewardsSchema, listRewardsQuerySchema } from "../validators/rewards.schemas.js";
import type { ListRewardsQuery } from "../validators/rewards.schemas.js";

export const rewardsRouter = Router();

rewardsRouter.get("/me", requireAuth, async (request, response, next) => {
  try {
    response.json(await listMyRewards(request.user!.id));
  } catch (error) {
    next(error);
  }
});

rewardsRouter.get(
  "/",
  requireAuth,
  requireRole(UserRole.ADMIN),
  validateQuery(listRewardsQuerySchema),
  async (_request, response, next) => {
    try {
      response.json(await listRewards(response.locals.validatedQuery as ListRewardsQuery));
    } catch (error) {
      next(error);
    }
  }
);

rewardsRouter.put(
  "/:userId",
  requireAuth,
  requireRole(UserRole.ADMIN),
  validateBody(adjustRewardsSchema),
  async (request, response, next) => {
    try {
      const { userId } = request.params;

      if (typeof userId !== "string") {
        response.status(400).json({ error: "Validation Error", message: "User id is required." });
        return;
      }

      response.json(await adjustRewards(userId, request.body));
    } catch (error) {
      next(error);
    }
  }
);
