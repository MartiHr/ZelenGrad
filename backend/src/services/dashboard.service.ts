import {
  AdoptionStatus,
  AssetHealthStatus,
  AssetLifecycleStatus,
  IncidentStatus,
  MaintenanceTaskStatus
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const toCountMap = <T extends string>(items: Array<{ key: T; count: number }>, keys: readonly T[]) =>
  keys.reduce<Record<T, number>>(
    (accumulator, key) => ({
      ...accumulator,
      [key]: items.find((item) => item.key === key)?.count ?? 0
    }),
    {} as Record<T, number>
  );

export const getDashboardSummary = async () => {
  const today = startOfToday();

  const [
    assetTotal,
    activeAssetTotal,
    assetHealthGroups,
    openIncidentTotal,
    incidentStatusGroups,
    urgentIncidentTotal,
    maintenanceStatusGroups,
    dueMaintenanceTotal,
    completedTodayTotal,
    activeAdoptionTotal,
    careLogsTodayTotal,
    recentIncidents,
    recentTasks,
    recentAdoptions
  ] = await Promise.all([
    prisma.greenAsset.count(),
    prisma.greenAsset.count({ where: { lifecycleStatus: AssetLifecycleStatus.ACTIVE } }),
    prisma.greenAsset.groupBy({
      by: ["healthStatus"],
      _count: { _all: true }
    }),
    prisma.incidentReport.count({
      where: {
        status: {
          in: [IncidentStatus.REPORTED, IncidentStatus.VERIFIED, IncidentStatus.IN_PROGRESS]
        }
      }
    }),
    prisma.incidentReport.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    prisma.incidentReport.count({
      where: {
        priority: "URGENT",
        status: {
          notIn: [IncidentStatus.RESOLVED, IncidentStatus.REJECTED]
        }
      }
    }),
    prisma.maintenanceTask.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    prisma.maintenanceTask.count({
      where: {
        dueAt: { lte: new Date() },
        status: {
          in: [MaintenanceTaskStatus.PLANNED, MaintenanceTaskStatus.ASSIGNED, MaintenanceTaskStatus.IN_PROGRESS]
        }
      }
    }),
    prisma.maintenanceTask.count({
      where: {
        completedAt: { gte: today },
        status: MaintenanceTaskStatus.COMPLETED
      }
    }),
    prisma.adoption.count({
      where: { status: AdoptionStatus.ACTIVE }
    }),
    prisma.adoptionCareLog.count({
      where: { loggedAt: { gte: today } }
    }),
    prisma.incidentReport.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        zone: { select: { id: true, name: true } },
        asset: { select: { id: true, commonName: true, species: true } }
      }
    }),
    prisma.maintenanceTask.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueAt: true,
        updatedAt: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        asset: { select: { id: true, commonName: true, species: true } },
        zone: { select: { id: true, name: true } }
      }
    }),
    prisma.adoption.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        startedAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
        asset: { select: { id: true, commonName: true, species: true } },
        _count: {
          select: {
            careLogs: true
          }
        }
      }
    })
  ]);

  return {
    generatedAt: new Date().toISOString(),
    assets: {
      total: assetTotal,
      active: activeAssetTotal,
      byHealth: toCountMap(
        assetHealthGroups.map((group) => ({ key: group.healthStatus, count: group._count._all })),
        Object.values(AssetHealthStatus)
      )
    },
    incidents: {
      open: openIncidentTotal,
      urgentOpen: urgentIncidentTotal,
      byStatus: toCountMap(
        incidentStatusGroups.map((group) => ({ key: group.status, count: group._count._all })),
        Object.values(IncidentStatus)
      )
    },
    maintenance: {
      due: dueMaintenanceTotal,
      completedToday: completedTodayTotal,
      byStatus: toCountMap(
        maintenanceStatusGroups.map((group) => ({ key: group.status, count: group._count._all })),
        Object.values(MaintenanceTaskStatus)
      )
    },
    adoptions: {
      active: activeAdoptionTotal,
      careLogsToday: careLogsTodayTotal
    },
    recent: {
      incidents: recentIncidents,
      maintenanceTasks: recentTasks,
      adoptions: recentAdoptions
    }
  };
};
