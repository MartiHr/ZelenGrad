import { z } from "zod";

export const createZoneSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional()
});

export const zoneAssignmentSchema = z.object({
  employeeId: z.string().trim().min(1)
});

export type CreateZoneInput = z.infer<typeof createZoneSchema>;
export type ZoneAssignmentInput = z.infer<typeof zoneAssignmentSchema>;
