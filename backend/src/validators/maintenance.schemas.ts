import { AssetHealthStatus, MaintenanceTaskStatus, MaintenanceTaskType, Priority } from "@prisma/client";
import { z } from "zod";

export const listMaintenanceQuerySchema = z.object({
  status: z.nativeEnum(MaintenanceTaskStatus).optional(),
  assignedToId: z.string().trim().min(1).optional(),
  responsibleEmployeeId: z.string().trim().min(1).optional(),
  responsibleZoneOnly: z.coerce.boolean().optional(),
  assetId: z.string().trim().min(1).optional(),
  zoneId: z.string().trim().min(1).optional()
});

export const createMaintenanceTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(1000).optional(),
    type: z.nativeEnum(MaintenanceTaskType),
    status: z.nativeEnum(MaintenanceTaskStatus).default(MaintenanceTaskStatus.PLANNED),
    priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
    scheduledFor: z.coerce.date().optional(),
    dueAt: z.coerce.date().optional(),
    recurrenceRule: z.string().trim().max(160).optional(),
    assetId: z.string().trim().min(1).optional(),
    zoneId: z.string().trim().min(1).optional(),
    assignedToId: z.string().trim().min(1).optional()
  })
  .refine((input) => input.assetId || input.zoneId, {
    message: "A maintenance task must target either an asset or a zone.",
    path: ["assetId"]
  });

export const updateMaintenanceStatusSchema = z.object({
  status: z.nativeEnum(MaintenanceTaskStatus),
  notes: z.string().trim().max(1000).optional(),
  resultingHealth: z.nativeEnum(AssetHealthStatus).optional()
});

export const updateMaintenanceTaskSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    type: z.nativeEnum(MaintenanceTaskType).optional(),
    priority: z.nativeEnum(Priority).optional(),
    scheduledFor: z.coerce.date().nullable().optional(),
    dueAt: z.coerce.date().nullable().optional(),
    recurrenceRule: z.string().trim().max(160).nullable().optional(),
    assetId: z.string().trim().min(1).nullable().optional(),
    zoneId: z.string().trim().min(1).nullable().optional(),
    assignedToId: z.string().trim().min(1).nullable().optional()
  })
  .refine((input) => input.assetId !== null || input.zoneId !== null, {
    message: "A maintenance task must keep either an asset or a zone target.",
    path: ["assetId"]
  });

export type ListMaintenanceQuery = z.infer<typeof listMaintenanceQuerySchema>;
export type CreateMaintenanceTaskInput = z.infer<typeof createMaintenanceTaskSchema>;
export type UpdateMaintenanceStatusInput = z.infer<typeof updateMaintenanceStatusSchema>;
export type UpdateMaintenanceTaskInput = z.infer<typeof updateMaintenanceTaskSchema>;
