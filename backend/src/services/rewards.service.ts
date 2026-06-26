import { type Prisma, RewardReason } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import type { AdjustRewardsInput, ListRewardsQuery } from "../validators/rewards.schemas.js";
import { AppError, getUserById } from "./users.service.js";

const rewardInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      greenPoints: true
    }
  }
} satisfies Prisma.RewardTransactionInclude;

export const listMyRewards = async (userId: string) => {
  await getUserById(userId);

  return prisma.rewardTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: rewardInclude
  });
};

export const listRewards = async (query: ListRewardsQuery) => {
  return prisma.rewardTransaction.findMany({
    where: {
      userId: query.userId
    },
    orderBy: { createdAt: "desc" },
    include: rewardInclude
  });
};

export const adjustRewards = async (userId: string, input: AdjustRewardsInput) => {
  const user = await getUserById(userId);

  if (input.points === 0) {
    throw new AppError(400, "Point adjustment cannot be zero.");
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: user.id },
      data: { greenPoints: { increment: input.points } }
    });

    return transaction.rewardTransaction.create({
      data: {
        userId,
        points: input.points,
        reason: input.reason ?? RewardReason.MANUAL_ADJUSTMENT,
        description: input.description
      },
      include: rewardInclude
    });
  });
};
