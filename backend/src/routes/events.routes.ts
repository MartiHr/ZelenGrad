import { Router } from "express";

import { sseHub } from "../realtime/sseHub.js";

export const eventsRouter = Router();

eventsRouter.get("/", (request, response) => {
  const disconnect = sseHub.connect(response);
  request.on("close", disconnect);
});
