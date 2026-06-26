import { z } from "zod";

export const createAdoptionSchema = z.object({
  assetId: z.string().trim().min(1),
  notes: z.string().trim().max(1000).optional()
});

export const createCareLogSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
  photoUrls: z.array(z.string().trim().url()).default([])
});

export type CreateAdoptionInput = z.infer<typeof createAdoptionSchema>;
export type CreateCareLogInput = z.infer<typeof createCareLogSchema>;
