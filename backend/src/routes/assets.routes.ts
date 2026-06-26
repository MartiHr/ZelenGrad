import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { validateQuery } from "../middleware/validateQuery.js";
import {
  archiveAsset,
  createAsset,
  getAssetById,
  getAssetHistory,
  listAssets,
  updateAsset
} from "../services/assets.service.js";
import { createAssetSchema, listAssetsQuerySchema, updateAssetSchema } from "../validators/assets.schemas.js";
import type { ListAssetsQuery } from "../validators/assets.schemas.js";

export const assetsRouter = Router();

const managerRoles = [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.ADMIN];

assetsRouter.get("/", validateQuery(listAssetsQuerySchema), async (_request, response, next) => {
  try {
    response.json(await listAssets(response.locals.validatedQuery as ListAssetsQuery));
  } catch (error) {
    next(error);
  }
});

assetsRouter.post(
  "/",
  requireAuth,
  requireRole(...managerRoles),
  validateBody(createAssetSchema),
  async (request, response, next) => {
    try {
      response.status(201).json(await createAsset(request.body, request.user!.id));
    } catch (error) {
      next(error);
    }
  }
);

assetsRouter.get("/:assetId/history", async (request, response, next) => {
  try {
    const { assetId } = request.params;

    if (typeof assetId !== "string") {
      response.status(400).json({ error: "Validation Error", message: "Asset id is required." });
      return;
    }

    response.json(await getAssetHistory(assetId));
  } catch (error) {
    next(error);
  }
});

assetsRouter.get("/:assetId", async (request, response, next) => {
  try {
    const { assetId } = request.params;

    if (typeof assetId !== "string") {
      response.status(400).json({ error: "Validation Error", message: "Asset id is required." });
      return;
    }

    response.json(await getAssetById(assetId));
  } catch (error) {
    next(error);
  }
});

assetsRouter.put(
  "/:assetId",
  requireAuth,
  requireRole(...managerRoles),
  validateBody(updateAssetSchema),
  async (request, response, next) => {
    try {
      const { assetId } = request.params;

      if (typeof assetId !== "string") {
        response.status(400).json({ error: "Validation Error", message: "Asset id is required." });
        return;
      }

      response.json(await updateAsset(assetId, request.body));
    } catch (error) {
      next(error);
    }
  }
);

assetsRouter.delete("/:assetId", requireAuth, requireRole(...managerRoles), async (request, response, next) => {
  try {
    const { assetId } = request.params;

    if (typeof assetId !== "string") {
      response.status(400).json({ error: "Validation Error", message: "Asset id is required." });
      return;
    }

    response.json(await archiveAsset(assetId));
  } catch (error) {
    next(error);
  }
});
