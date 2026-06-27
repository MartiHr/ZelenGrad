import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

const getValidationMessage = (fieldErrors: Record<string, string[] | undefined>) => {
  const [field, messages] = Object.entries(fieldErrors).find(([, errors]) => errors?.length) ?? [];
  const message = messages?.[0];

  if (!field || !message) {
    return "Please check the submitted fields.";
  }

  return `${field}: ${message}`;
};

export const validateBody =
  <T>(schema: ZodSchema<T>) =>
  (request: Request, response: Response, next: NextFunction) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;

      response.status(400).json({
        error: "Validation Error",
        message: getValidationMessage(fieldErrors),
        issues: fieldErrors
      });
      return;
    }

    request.body = result.data;
    next();
  };
