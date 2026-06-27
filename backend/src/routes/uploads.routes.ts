import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { UserRole } from "@prisma/client";
import express, { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";

const uploadRoot = path.resolve(process.cwd(), "uploads", "assets");
const maxUploadBytes = 5 * 1024 * 1024;
const allowedImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

export const uploadsRouter = Router();

uploadsRouter.post(
  "/assets",
  requireAuth,
  requireRole(UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.ADMIN),
  express.raw({ type: Object.keys(allowedImageTypes), limit: `${maxUploadBytes}b` }),
  async (request, response, next) => {
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

      await mkdir(uploadRoot, { recursive: true });

      const fileName = `${randomUUID()}.${extension}`;
      await writeFile(path.join(uploadRoot, fileName), request.body);

      response.status(201).json({
        url: `${request.protocol}://${request.get("host")}/uploads/assets/${fileName}`
      });
    } catch (error) {
      next(error);
    }
  }
);
