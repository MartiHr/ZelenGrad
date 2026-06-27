import { z } from "zod";

export const dashboardSummaryQuerySchema = z.object({
  zoneId: z.string().trim().min(1).optional(),
  responsibleEmployeeId: z.string().trim().min(1).optional(),
  timeWindow: z.enum(["ALL", "TODAY", "7D", "30D"]).default("ALL")
});

export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;
