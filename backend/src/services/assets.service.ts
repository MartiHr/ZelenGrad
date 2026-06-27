import { AssetLifecycleStatus, type Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { sseHub } from "../realtime/sseHub.js";
import type { CreateAssetInput, ListAssetsQuery, UpdateAssetInput } from "../validators/assets.schemas.js";
import { AppError } from "./users.service.js";

const assetInclude = {
  zone: {
    select: {
      id: true,
      name: true
    }
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  }
} satisfies Prisma.GreenAssetInclude;

export const listAssets = async (query: ListAssetsQuery) => {
  return prisma.greenAsset.findMany({
    where: {
      lifecycleStatus: AssetLifecycleStatus.ACTIVE,
      species: query.species ? { contains: query.species, mode: "insensitive" } : undefined,
      healthStatus: query.healthStatus,
      zoneId: query.zoneId,
      type: query.type
    },
    orderBy: { createdAt: "desc" },
    include: assetInclude
  });
};

export const getAssetById = async (assetId: string) => {
  const asset = await prisma.greenAsset.findUnique({
    where: { id: assetId },
    include: assetInclude
  });

  if (!asset) {
    throw new AppError(404, "Green asset not found.");
  }

  return asset;
};

export const createAsset = async (input: CreateAssetInput, createdById: string) => {
  const asset = await prisma.$transaction(async (tx) => {
    const createdAsset = await tx.greenAsset.create({
      data: {
        ...input,
        createdById,
        plantedAt: input.plantedAt
      },
      include: assetInclude
    });

    await tx.assetHealthLog.create({
      data: {
        assetId: createdAsset.id,
        status: createdAsset.healthStatus,
        source: "registry",
        notes: "Initial registry health status."
      }
    });

    return createdAsset;
  });

  sseHub.broadcast("asset.updated", {
    assetId: asset.id,
    action: "created",
    updatedAt: new Date().toISOString()
  });

  return asset;
};

export const updateAsset = async (assetId: string, input: UpdateAssetInput) => {
  const existingAsset = await getAssetById(assetId);

  const asset = await prisma.$transaction(async (tx) => {
    const updatedAsset = await tx.greenAsset.update({
      where: { id: assetId },
      data: input,
      include: assetInclude
    });

    if (input.healthStatus && input.healthStatus !== existingAsset.healthStatus) {
      await tx.assetHealthLog.create({
        data: {
          assetId,
          status: input.healthStatus,
          source: "registry",
          notes: "Registry health status updated."
        }
      });
    }

    return updatedAsset;
  });

  sseHub.broadcast("asset.updated", {
    assetId: asset.id,
    action: "updated",
    updatedAt: new Date().toISOString()
  });

  return asset;
};

export const archiveAsset = async (assetId: string) => {
  await getAssetById(assetId);

  const asset = await prisma.greenAsset.update({
    where: { id: assetId },
    data: { lifecycleStatus: AssetLifecycleStatus.ARCHIVED },
    include: assetInclude
  });

  sseHub.broadcast("asset.updated", {
    assetId: asset.id,
    action: "archived",
    updatedAt: new Date().toISOString()
  });

  return asset;
};

export const getAssetHistory = async (assetId: string) => {
  await getAssetById(assetId);

  const [healthLogs, maintenanceLogs] = await Promise.all([
    prisma.assetHealthLog.findMany({
      where: { assetId },
      orderBy: { recordedAt: "desc" }
    }),
    prisma.maintenanceLog.findMany({
      where: { assetId },
      orderBy: { performedAt: "desc" },
      include: {
        employee: {
          select: { id: true, name: true, email: true }
        },
        task: {
          select: { id: true, title: true, type: true, status: true }
        }
      }
    })
  ]);

  return { healthLogs, maintenanceLogs };
};
