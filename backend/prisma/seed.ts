import "dotenv/config";

import { AssetHealthStatus, GreenAssetType, IncidentStatus, IncidentType, Priority, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/prisma.js";

const password = "password123";

const users = [
  { email: "admin@zelengrad.test", name: "Admin User", role: UserRole.ADMIN },
  { email: "manager@zelengrad.test", name: "Municipal Manager", role: UserRole.MANAGER },
  { email: "employee@zelengrad.test", name: "Field Employee", role: UserRole.EMPLOYEE },
  { email: "citizen@zelengrad.test", name: "Citizen User", role: UserRole.CITIZEN }
];

const zones = [
  {
    name: "Central Park Zone",
    description: "Downtown public green zone around the central park paths."
  },
  {
    name: "University District",
    description: "Green assets near the campus and student residential streets."
  }
];

const run = async () => {
  const passwordHash = await bcrypt.hash(password, 12);

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        isActive: true,
        passwordHash
      },
      create: {
        ...user,
        passwordHash
      }
    });
  }

  const [centralPark, universityDistrict] = await Promise.all(
    zones.map((zone) =>
      prisma.zone.upsert({
        where: { name: zone.name },
        update: zone,
        create: zone
      })
    )
  );

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@zelengrad.test" } });
  const citizen = await prisma.user.findUniqueOrThrow({ where: { email: "citizen@zelengrad.test" } });

  const centralOak = await prisma.greenAsset.upsert({
    where: { id: "seed-asset-central-oak" },
    update: {
      commonName: "Central Oak",
      species: "Quercus robur",
      type: GreenAssetType.TREE,
      healthStatus: AssetHealthStatus.HEALTHY,
      latitude: 42.697708,
      longitude: 23.321868,
      zoneId: centralPark.id,
      createdById: admin.id
    },
    create: {
      id: "seed-asset-central-oak",
      commonName: "Central Oak",
      species: "Quercus robur",
      type: GreenAssetType.TREE,
      healthStatus: AssetHealthStatus.HEALTHY,
      latitude: 42.697708,
      longitude: 23.321868,
      zoneId: centralPark.id,
      createdById: admin.id
    }
  });

  const campusLinden = await prisma.greenAsset.upsert({
    where: { id: "seed-asset-campus-linden" },
    update: {
      commonName: "Campus Linden",
      species: "Tilia cordata",
      type: GreenAssetType.TREE,
      healthStatus: AssetHealthStatus.NEEDS_ATTENTION,
      latitude: 42.674326,
      longitude: 23.330191,
      zoneId: universityDistrict.id,
      createdById: admin.id
    },
    create: {
      id: "seed-asset-campus-linden",
      commonName: "Campus Linden",
      species: "Tilia cordata",
      type: GreenAssetType.TREE,
      healthStatus: AssetHealthStatus.NEEDS_ATTENTION,
      latitude: 42.674326,
      longitude: 23.330191,
      zoneId: universityDistrict.id,
      createdById: admin.id
    }
  });

  await prisma.incidentReport.upsert({
    where: { id: "seed-incident-campus-linden-dry" },
    update: {
      type: IncidentType.DRY_TREE,
      status: IncidentStatus.REPORTED,
      priority: Priority.HIGH,
      title: "Campus Linden looks dry",
      description: "Leaves near the lower branches are curling and the soil around the tree is very dry.",
      reporterId: citizen.id,
      assetId: campusLinden.id,
      zoneId: universityDistrict.id,
      latitude: 42.674326,
      longitude: 23.330191
    },
    create: {
      id: "seed-incident-campus-linden-dry",
      type: IncidentType.DRY_TREE,
      status: IncidentStatus.REPORTED,
      priority: Priority.HIGH,
      title: "Campus Linden looks dry",
      description: "Leaves near the lower branches are curling and the soil around the tree is very dry.",
      reporterId: citizen.id,
      assetId: campusLinden.id,
      zoneId: universityDistrict.id,
      latitude: 42.674326,
      longitude: 23.330191
    }
  });

  console.log("Seeded development users, zones, and starter green assets.");
  console.log(`All seeded users use password: ${password}`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
