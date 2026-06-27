import { prisma } from "../lib/prisma.js";

export const getAuditOverview = async () => {
  const [rewardTransactions, users, incidents, maintenanceTasks, maintenanceLogs, assetHealthLogs] = await Promise.all([
    prisma.rewardTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            greenPoints: true
          }
        }
      }
    }),
    prisma.user.findMany({
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        greenPoints: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.incidentReport.findMany({
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        verifiedAt: true,
        resolvedAt: true,
        reporter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        asset: {
          select: {
            id: true,
            commonName: true,
            species: true
          }
        },
        zone: {
          select: {
            id: true,
            name: true
          }
        }
      }
    }),
    prisma.maintenanceTask.findMany({
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        completedAt: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        completedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        asset: {
          select: {
            id: true,
            commonName: true,
            species: true
          }
        },
        zone: {
          select: {
            id: true,
            name: true
          }
        }
      }
    }),
    prisma.maintenanceLog.findMany({
      orderBy: { performedAt: "desc" },
      take: 12,
      select: {
        id: true,
        notes: true,
        resultingHealth: true,
        performedAt: true,
        employee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true
          }
        },
        asset: {
          select: {
            id: true,
            commonName: true,
            species: true
          }
        }
      }
    }),
    prisma.assetHealthLog.findMany({
      orderBy: { recordedAt: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        source: true,
        notes: true,
        recordedAt: true,
        asset: {
          select: {
            id: true,
            commonName: true,
            species: true
          }
        }
      }
    })
  ]);

  return {
    generatedAt: new Date().toISOString(),
    rewardTransactions,
    users,
    incidents,
    maintenanceTasks,
    maintenanceLogs,
    assetHealthLogs
  };
};
