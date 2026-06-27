import { Router } from "express";

import { adoptionsRouter } from "./adoptions.routes.js";
import { assetsRouter } from "./assets.routes.js";
import { authRouter } from "./auth.routes.js";
import { dashboardRouter } from "./dashboard.routes.js";
import { eventsRouter } from "./events.routes.js";
import { healthRouter } from "./health.routes.js";
import { incidentsRouter } from "./incidents.routes.js";
import { maintenanceRouter } from "./maintenance.routes.js";
import { rewardsRouter } from "./rewards.routes.js";
import { usersRouter } from "./users.routes.js";
import { zonesRouter } from "./zones.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/events", eventsRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/zones", zonesRouter);
apiRouter.use("/assets", assetsRouter);
apiRouter.use("/maintenance", maintenanceRouter);
apiRouter.use("/adoptions", adoptionsRouter);
apiRouter.use("/incidents", incidentsRouter);
apiRouter.use("/rewards", rewardsRouter);
