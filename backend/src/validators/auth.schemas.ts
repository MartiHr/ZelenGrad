import { UserRole } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(128)
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128)
});

export const updateCurrentUserSchema = z.object({
  email: z.string().trim().email().max(255).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(8).max(128).optional()
});

export const adminUpdateUserSchema = updateCurrentUserSchema.extend({
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional()
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateCurrentUserInput = z.infer<typeof updateCurrentUserSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
