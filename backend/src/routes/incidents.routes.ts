import { Router } from "express";

import { sseHub } from "../realtime/sseHub.js";

export const incidentsRouter = Router();

incidentsRouter.get("/", (_request, response) => {
  response.status(501).json({ message: "List incident reports placeholder." });
});

incidentsRouter.post("/", (request, response) => {
  sseHub.broadcast("incident.created", {
    draft: request.body,
    receivedAt: new Date().toISOString()
  });

  response.status(501).json({
    message: "Create incident report placeholder. SSE broadcast is wired for live dashboards."
  });
});

incidentsRouter.put("/:incidentId", (request, response) => {
  sseHub.broadcast("incident.updated", {
    incidentId: request.params.incidentId,
    draft: request.body,
    updatedAt: new Date().toISOString()
  });

  response.status(501).json({
    message: `Update incident ${request.params.incidentId} placeholder. SSE broadcast is wired.`
  });
});
