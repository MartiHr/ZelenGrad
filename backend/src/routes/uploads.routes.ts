import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { UserRole } from "@prisma/client";
import express, { type NextFunction, type Request, type Response, Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";

const uploadsRoot = path.resolve(process.cwd(), "uploads");
const maxUploadBytes = 5 * 1024 * 1024;
const allowedImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export const uploadsRouter = Router();

const createImageUploadHandler =
  (directoryName: "assets" | "care-logs") =>
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const contentType = request.header("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
      const extension = allowedImageTypes[contentType];

      if (!extension) {
        response.status(400).json({
          error: "Validation Error",
          message: "Only JPG, PNG, WebP, and GIF images can be uploaded."
        });
        return;
      }

      if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
        response.status(400).json({ error: "Validation Error", message: "Image file is required." });
        return;
      }

      const uploadRoot = path.join(uploadsRoot, directoryName);
      await mkdir(uploadRoot, { recursive: true });

      const fileName = `${randomUUID()}.${extension}`;
      await writeFile(path.join(uploadRoot, fileName), request.body);

      response.status(201).json({
        url: `${request.protocol}://${request.get("host")}/uploads/${directoryName}/${fileName}`
      });
    } catch (error) {
      next(error);
    }
  };

uploadsRouter.post(
  "/assets",
  requireAuth,
  requireRole(UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.ADMIN),
  express.raw({ type: Object.keys(allowedImageTypes), limit: `${maxUploadBytes}b` }),
  createImageUploadHandler("assets")
);

uploadsRouter.post(
  "/care-logs",
  requireAuth,
  requireRole(UserRole.CITIZEN),
  express.raw({ type: Object.keys(allowedImageTypes), limit: `${maxUploadBytes}b` }),
  createImageUploadHandler("care-logs")
);
