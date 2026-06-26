import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

export const validateQuery =
  <T>(schema: ZodSchema<T>) =>
  (request: Request, response: Response, next: NextFunction) => {
    const result = schema.safeParse(request.query);

    if (!result.success) {
      response.status(400).json({
        error: "Validation Error",
        issues: result.error.flatten().fieldErrors
      });
      return;
    }

    response.locals.validatedQuery = result.data;
    next();
  };
