import {
  AdoptionStatus,
  AssetHealthStatus,
  AssetLifecycleStatus,
  IncidentStatus,
  MaintenanceTaskStatus,
  type Prisma
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import type { DashboardSummaryQuery } from "../validators/dashboard.schemas.js";

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const getWindowStart = (timeWindow: DashboardSummaryQuery["timeWindow"]) => {
  if (timeWindow === "ALL") {
    return undefined;
  }

  const date = new Date();

  if (timeWindow === "TODAY") {
    date.setHours(0, 0, 0, 0);
    return date;
  }

  date.setDate(date.getDate() - (timeWindow === "7D" ? 7 : 30));
  return date;
};

const buildAssetWhere = (query: DashboardSummaryQuery, since?: Date): Prisma.GreenAssetWhereInput => ({
  createdAt: since ? { gte: since } : undefined,
  zoneId: query.zoneId,
  zone: query.responsibleEmployeeId
    ? {
        assignments: {
          some: { employeeId: query.responsibleEmployeeId }
        }
      }
    : undefined
});

const buildIncidentWhere = (query: DashboardSummaryQuery, since?: Date): Prisma.IncidentReportWhereInput => ({
  createdAt: since ? { gte: since } : undefined,
  AND: [
    query.zoneId
      ? {
          OR: [{ zoneId: query.zoneId }, { asset: { zoneId: query.zoneId } }]
        }
      : {},
    query.responsibleEmployeeId
      ? {
          OR: [
            { zone: { assignments: { some: { employeeId: query.responsibleEmployeeId } } } },
            { asset: { zone: { assignments: { some: { employeeId: query.responsibleEmployeeId } } } } }
          ]
        }
      : {}
  ]
});

const buildMaintenanceWhere = (
  query: DashboardSummaryQuery,
  since?: Date,
  dateField: "createdAt" | "completedAt" = "createdAt"
): Prisma.MaintenanceTaskWhereInput => ({
  [dateField]: since ? { gte: since } : undefined,
  AND: [
    query.zoneId
      ? {
          OR: [{ zoneId: query.zoneId }, { asset: { zoneId: query.zoneId } }]
        }
      : {},
    query.responsibleEmployeeId
      ? {
          OR: [
            { zone: { assignments: { some: { employeeId: query.responsibleEmployeeId } } } },
            { asset: { zone: { assignments: { some: { employeeId: query.responsibleEmployeeId } } } } }
          ]
        }
      : {}
  ]
});

const buildAdoptionWhere = (query: DashboardSummaryQuery, since?: Date): Prisma.AdoptionWhereInput => ({
  startedAt: since ? { gte: since } : undefined,
  asset: {
    zoneId: query.zoneId,
    zone: query.responsibleEmployeeId
      ? {
          assignments: {
            some: { employeeId: query.responsibleEmployeeId }
          }
        }
      : undefined
  }
});

const buildCareLogWhere = (query: DashboardSummaryQuery, since?: Date): Prisma.AdoptionCareLogWhereInput => ({
  loggedAt: since ? { gte: since } : undefined,
  adoption: {
    asset: {
      zoneId: query.zoneId,
      zone: query.responsibleEmployeeId
        ? {
            assignments: {
              some: { employeeId: query.responsibleEmployeeId }
            }
          }
        : undefined
    }
  }
});

const toCountMap = <T extends string>(items: Array<{ key: T; count: number }>, keys: readonly T[]) =>
  keys.reduce<Record<T, number>>(
    (accumulator, key) => ({
      ...accumulator,
      [key]: items.find((item) => item.key === key)?.count ?? 0
    }),
    {} as Record<T, number>
  );

export const getDashboardSummary = async (query: DashboardSummaryQuery) => {
  const today = startOfToday();
  const since = getWindowStart(query.timeWindow);
  const assetWhere = buildAssetWhere(query, since);
  const incidentWhere = buildIncidentWhere(query, since);
  const maintenanceWhere = buildMaintenanceWhere(query, since);
  const completedMaintenanceWhere = buildMaintenanceWhere(query, since ?? today, "completedAt");
  const adoptionWhere = buildAdoptionWhere(query, since);
  const careLogWhere = buildCareLogWhere(query, since ?? today);

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
    prisma.greenAsset.count({ where: assetWhere }),
    prisma.greenAsset.count({ where: { ...assetWhere, lifecycleStatus: AssetLifecycleStatus.ACTIVE } }),
    prisma.greenAsset.groupBy({
      by: ["healthStatus"],
      where: assetWhere,
      _count: { _all: true }
    }),
    prisma.incidentReport.count({
      where: {
        ...incidentWhere,
        status: {
          in: [IncidentStatus.REPORTED, IncidentStatus.VERIFIED, IncidentStatus.IN_PROGRESS]
        }
      }
    }),
    prisma.incidentReport.groupBy({
      by: ["status"],
      where: incidentWhere,
      _count: { _all: true }
    }),
    prisma.incidentReport.count({
      where: {
        ...incidentWhere,
        priority: "URGENT",
        status: {
          notIn: [IncidentStatus.RESOLVED, IncidentStatus.REJECTED]
        }
      }
    }),
    prisma.maintenanceTask.groupBy({
      by: ["status"],
      where: maintenanceWhere,
      _count: { _all: true }
    }),
    prisma.maintenanceTask.count({
      where: {
        ...maintenanceWhere,
        dueAt: { lte: new Date() },
        status: {
          in: [MaintenanceTaskStatus.PLANNED, MaintenanceTaskStatus.ASSIGNED, MaintenanceTaskStatus.IN_PROGRESS]
        }
      }
    }),
    prisma.maintenanceTask.count({
      where: {
        ...completedMaintenanceWhere,
        status: MaintenanceTaskStatus.COMPLETED
      }
    }),
    prisma.adoption.count({
      where: { ...adoptionWhere, status: AdoptionStatus.ACTIVE }
    }),
    prisma.adoptionCareLog.count({
      where: careLogWhere
    }),
    prisma.incidentReport.findMany({
      where: incidentWhere,
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
      where: maintenanceWhere,
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
      where: adoptionWhere,
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
    filters: {
      zoneId: query.zoneId ?? null,
      responsibleEmployeeId: query.responsibleEmployeeId ?? null,
      timeWindow: query.timeWindow,
      since: since?.toISOString() ?? null
    },
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
