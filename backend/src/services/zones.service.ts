import type { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import type { CreateZoneInput } from "../validators/zones.schemas.js";

const zoneInclude = {
  _count: {
    select: {
      assets: true,
      tasks: true,
      incidents: true,
      assignments: true
    }
  }
} satisfies Prisma.ZoneInclude;

export const listZones = async () => {
  return prisma.zone.findMany({
    orderBy: { name: "asc" },
    include: zoneInclude
  });
};

export const createZone = async (input: CreateZoneInput) => {
  return prisma.zone.create({
    data: input,
    include: zoneInclude
  });
};
