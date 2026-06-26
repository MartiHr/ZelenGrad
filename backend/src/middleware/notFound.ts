import type { Request, Response } from "express";

export const notFound = (request: Request, response: Response) => {
  response.status(404).json({
    error: "Not Found",
    message: `No route registered for ${request.method} ${request.originalUrl}`
  });
};
