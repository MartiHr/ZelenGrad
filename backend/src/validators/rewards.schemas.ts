import { RewardReason } from "@prisma/client";
import { z } from "zod";

export const listRewardsQuerySchema = z.object({
  userId: z.string().trim().min(1).optional()
});

export const adjustRewardsSchema = z.object({
  points: z.coerce.number().int().min(-10000).max(10000),
  reason: z.nativeEnum(RewardReason).default(RewardReason.MANUAL_ADJUSTMENT),
  description: z.string().trim().min(3).max(1000)
});

export type ListRewardsQuery = z.infer<typeof listRewardsQuerySchema>;
export type AdjustRewardsInput = z.infer<typeof adjustRewardsSchema>;
