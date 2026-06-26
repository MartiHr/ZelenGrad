import { UserRole } from "@prisma/client";
import { Router } from "express";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  deactivateUser,
  getUserById,
  listStaffUsers,
  listUsers,
  registerCitizen,
  updateCurrentUser,
  updateUserAsAdmin
} from "../services/users.service.js";
import { adminUpdateUserSchema, registerSchema, updateCurrentUserSchema } from "../validators/auth.schemas.js";

export const usersRouter = Router();

usersRouter.post("/", validateBody(registerSchema), async (request, response, next) => {
  try {
    response.status(201).json(await registerCitizen(request.body));
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/me", requireAuth, async (request, response, next) => {
  try {
    response.json(await getUserById(request.user!.id));
  } catch (error) {
    next(error);
  }
});

usersRouter.put("/me", requireAuth, validateBody(updateCurrentUserSchema), async (request, response, next) => {
  try {
    response.json(await updateCurrentUser(request.user!.id, request.body));
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/", requireAuth, requireRole(UserRole.ADMIN), async (request, response, next) => {
  try {
    const isActive = typeof request.query.isActive === "string" ? request.query.isActive === "true" : undefined;
    const role = typeof request.query.role === "string" && request.query.role in UserRole ? (request.query.role as UserRole) : undefined;
    const email = typeof request.query.email === "string" ? request.query.email : undefined;

    response.json(await listUsers({ email, role, isActive }));
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/staff", requireAuth, requireRole(UserRole.MANAGER, UserRole.ADMIN), async (_request, response, next) => {
  try {
    response.json(await listStaffUsers());
  } catch (error) {
    next(error);
  }
});

usersRouter.get("/:userId", requireAuth, requireRole(UserRole.ADMIN), async (request, response, next) => {
  try {
    const { userId } = request.params;

    if (typeof userId !== "string") {
      response.status(400).json({ error: "Validation Error", message: "User id is required." });
      return;
    }

    response.json(await getUserById(userId));
  } catch (error) {
    next(error);
  }
});

usersRouter.put(
  "/:userId",
  requireAuth,
  requireRole(UserRole.ADMIN),
  validateBody(adminUpdateUserSchema),
  async (request, response, next) => {
    try {
      const { userId } = request.params;

      if (typeof userId !== "string") {
        response.status(400).json({ error: "Validation Error", message: "User id is required." });
        return;
      }

      response.json(await updateUserAsAdmin(userId, request.body));
    } catch (error) {
      next(error);
    }
  }
);

usersRouter.delete("/:userId", requireAuth, requireRole(UserRole.ADMIN), async (request, response, next) => {
  try {
    const { userId } = request.params;

    if (typeof userId !== "string") {
      response.status(400).json({ error: "Validation Error", message: "User id is required." });
      return;
    }

    response.json(await deactivateUser(userId));
  } catch (error) {
    next(error);
  }
});
