import { Router } from "express";

export const zonesRouter = Router();

zonesRouter.get("/", (_request, response) => {
  response.status(501).json({ message: "List municipal zones placeholder." });
});

zonesRouter.post("/", (_request, response) => {
  response.status(501).json({ message: "Create municipal zone placeholder." });
});
