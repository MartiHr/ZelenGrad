import { AdoptionStatus, AssetLifecycleStatus, GreenAssetType, RewardReason, type Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { sseHub } from "../realtime/sseHub.js";
import type { CreateAdoptionInput, CreateCareLogInput } from "../validators/adoptions.schemas.js";
import { AppError } from "./users.service.js";

const adoptionInclude = {
  asset: {
    select: {
      id: true,
      type: true,
      commonName: true,
      species: true,
      description: true,
      latitude: true,
      longitude: true,
      healthStatus: true,
      lifecycleStatus: true,
      metadata: true,
      zone: {
        select: {
          id: true,
          name: true
        }
      }
    }
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  careLogs: {
    orderBy: {
      loggedAt: "desc"
    }
  },
  _count: {
    select: {
      careLogs: true
    }
  }
} satisfies Prisma.AdoptionInclude;

export const listMyAdoptions = async (userId: string) => {
  return prisma.adoption.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    include: adoptionInclude
  });
};

export const createAdoption = async (userId: string, input: CreateAdoptionInput) => {
  const asset = await prisma.greenAsset.findUnique({
    where: { id: input.assetId },
    select: {
      id: true,
      type: true,
      lifecycleStatus: true,
      commonName: true,
      species: true
    }
  });

  if (!asset) {
    throw new AppError(404, "Green asset not found.");
  }

  if (asset.lifecycleStatus !== AssetLifecycleStatus.ACTIVE) {
    throw new AppError(409, "Only active green assets can be adopted.");
  }

  if (asset.type !== GreenAssetType.TREE) {
    throw new AppError(409, "Only trees can be adopted.");
  }

  const existingAdoption = await prisma.adoption.findUnique({
    where: {
      userId_assetId: {
        userId,
        assetId: input.assetId
      }
    }
  });

  if (existingAdoption) {
    throw new AppError(409, "You have already adopted this tree.");
  }

  const adoption = await prisma.$transaction(async (transaction) => {
    const createdAdoption = await transaction.adoption.create({
      data: {
        userId,
        assetId: input.assetId,
        notes: input.notes
      },
      include: adoptionInclude
    });

    await transaction.user.update({
      where: { id: userId },
      data: { greenPoints: { increment: 10 } }
    });

    await transaction.rewardTransaction.create({
      data: {
        userId,
        points: 10,
        reason: RewardReason.ADOPTION_CREATED,
        description: `Adopted ${asset.commonName ?? asset.species}.`
      }
    });

    return createdAdoption;
  });

  sseHub.broadcast("adoption.created", {
    adoptionId: adoption.id,
    assetId: adoption.assetId,
    assetName: adoption.asset.commonName ?? adoption.asset.species,
    status: adoption.status,
    startedAt: adoption.startedAt
  });

  return adoption;
};

export const createCareLog = async (userId: string, adoptionId: string, input: CreateCareLogInput) => {
  const adoption = await prisma.adoption.findFirst({
    where: {
      id: adoptionId,
      userId,
      status: AdoptionStatus.ACTIVE
    },
    include: {
      asset: {
        select: {
          id: true,
          commonName: true,
          species: true
        }
      }
    }
  });

  if (!adoption) {
    throw new AppError(404, "Active adoption not found.");
  }

  const careLog = await prisma.$transaction(async (transaction) => {
    const createdCareLog = await transaction.adoptionCareLog.create({
      data: {
        adoptionId,
        notes: input.notes,
        photoUrls: input.photoUrls
      }
    });

    await transaction.user.update({
      where: { id: userId },
      data: { greenPoints: { increment: 5 } }
    });

    await transaction.rewardTransaction.create({
      data: {
        userId,
        points: 5,
        reason: RewardReason.CARE_LOGGED,
        description: `Logged care for ${adoption.asset.commonName ?? adoption.asset.species}.`
      }
    });

    return createdCareLog;
  });

  sseHub.broadcast("adoption.care_logged", {
    adoptionId: adoption.id,
    careLogId: careLog.id,
    assetId: adoption.assetId,
    assetName: adoption.asset.commonName ?? adoption.asset.species,
    loggedAt: careLog.loggedAt
  });

  return careLog;
};
