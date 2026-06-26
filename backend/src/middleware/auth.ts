import { UserRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { verifyAuthToken } from "../services/auth.service.js";

const getBearerToken = (authorizationHeader: string | undefined) => {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length);
};

export const requireAuth = (request: Request, response: Response, next: NextFunction) => {
  const token = getBearerToken(request.header("authorization"));

  if (!token) {
    response.status(401).json({ error: "Unauthorized", message: "Authentication token is required." });
    return;
  }

  try {
    const payload = verifyAuthToken(token);

    if (!Object.values(UserRole).includes(payload.role as UserRole)) {
      response.status(401).json({ error: "Unauthorized", message: "Authentication token contains an invalid role." });
      return;
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role as UserRole
    };

    next();
  } catch (error) {
    const message = error instanceof jwt.TokenExpiredError ? "Authentication token has expired." : "Authentication token is invalid.";
    response.status(401).json({ error: "Unauthorized", message });
  }
};

export const requireRole =
  (...roles: UserRole[]) =>
  (request: Request, response: Response, next: NextFunction) => {
    if (!request.user) {
      response.status(401).json({ error: "Unauthorized", message: "Authentication is required." });
      return;
    }

    if (!roles.includes(request.user.role)) {
      response.status(403).json({ error: "Forbidden", message: "You do not have access to this resource." });
      return;
    }

    next();
  };
