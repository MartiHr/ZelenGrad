import type { ErrorRequestHandler } from "express";

import { AppError } from "../services/users.service.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: "Request Error",
      message: error.message
    });
    return;
  }

  if (error?.code === "P2025") {
    response.status(404).json({
      error: "Not Found",
      message: "The requested record was not found."
    });
    return;
  }

  if (error?.code === "P2002") {
    response.status(409).json({
      error: "Conflict",
      message: "A record with this unique value already exists."
    });
    return;
  }

  response.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? "Unexpected server error." : error.message
  });
};
