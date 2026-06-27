import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";

import { AppError } from "../services/users.service.js";

const getPrismaTarget = (error: Prisma.PrismaClientKnownRequestError) => {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.join(", ");
  }

  return typeof target === "string" ? target : null;
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: "Request Error",
      message: error.message
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      response.status(404).json({
        error: "Not Found",
        message: "The requested record was not found."
      });
      return;
    }

    if (error.code === "P2002") {
      const target = getPrismaTarget(error);

      response.status(409).json({
        error: "Conflict",
        message: target
          ? `A record with this ${target} already exists.`
          : "A record with this unique value already exists."
      });
      return;
    }

    if (error.code === "P2003") {
      response.status(400).json({
        error: "Invalid Relation",
        message: "One of the selected related records does not exist."
      });
      return;
    }

    if (error.code === "P2014") {
      response.status(400).json({
        error: "Invalid Relation",
        message: "This change would break a required relationship between records."
      });
      return;
    }
  }

  response.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? "Unexpected server error." : error.message
  });
};
