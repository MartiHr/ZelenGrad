import { Router } from "express";

import { sseHub } from "../realtime/sseHub.js";

export const maintenanceRouter = Router();

maintenanceRouter.get("/", (_request, response) => {
  response.status(501).json({ message: "List maintenance tasks placeholder." });
});

maintenanceRouter.post("/", (_request, response) => {
  response.status(501).json({ message: "Create maintenance task placeholder." });
});

maintenanceRouter.patch("/:taskId/status", (request, response) => {
  sseHub.broadcast("maintenance.updated", {
    taskId: request.params.taskId,
    updatedAt: new Date().toISOString()
  });

  response.status(501).json({
    message: `Update maintenance task ${request.params.taskId} status placeholder. SSE broadcast is wired.`
  });
});
