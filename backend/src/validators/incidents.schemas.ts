import { IncidentStatus, IncidentType, Priority } from "@prisma/client";
import { z } from "zod";

const coordinateSchema = z.coerce.number();

export const listIncidentsQuerySchema = z.object({
  status: z.nativeEnum(IncidentStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assetId: z.string().trim().min(1).optional(),
  zoneId: z.string().trim().min(1).optional()
});

export const createIncidentSchema = z.object({
  type: z.nativeEnum(IncidentType),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(2000),
  photoUrls: z.array(z.string().trim().url()).default([]),
  latitude: coordinateSchema.min(-90).max(90).optional(),
  longitude: coordinateSchema.min(-180).max(180).optional(),
  assetId: z.string().trim().min(1).optional(),
  zoneId: z.string().trim().min(1).optional()
});

export const updateIncidentSchema = z.object({
  status: z.nativeEnum(IncidentStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  photoUrls: z.array(z.string().trim().url()).optional(),
  assetId: z.string().trim().min(1).nullable().optional(),
  zoneId: z.string().trim().min(1).nullable().optional()
});

export type ListIncidentsQuery = z.infer<typeof listIncidentsQuerySchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
