import { AssetHealthStatus, AssetLifecycleStatus, GreenAssetType } from "@prisma/client";
import { z } from "zod";

const coordinateSchema = z.coerce.number();

export const listAssetsQuerySchema = z.object({
  species: z.string().trim().min(1).optional(),
  healthStatus: z.nativeEnum(AssetHealthStatus).optional(),
  zoneId: z.string().trim().min(1).optional(),
  type: z.nativeEnum(GreenAssetType).optional()
});

export const createAssetSchema = z.object({
  type: z.nativeEnum(GreenAssetType).default(GreenAssetType.TREE),
  commonName: z.string().trim().min(1).max(120).optional(),
  species: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  latitude: coordinateSchema.min(-90).max(90),
  longitude: coordinateSchema.min(-180).max(180),
  plantedAt: z.coerce.date().optional(),
  healthStatus: z.nativeEnum(AssetHealthStatus).default(AssetHealthStatus.HEALTHY),
  lifecycleStatus: z.nativeEnum(AssetLifecycleStatus).default(AssetLifecycleStatus.ACTIVE),
  zoneId: z.string().trim().min(1).optional()
});

export const updateAssetSchema = createAssetSchema.partial();

export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
