import { Router } from "express";

export const adoptionsRouter = Router();

adoptionsRouter.get("/", (_request, response) => {
  response.status(501).json({ message: "List adoption history placeholder." });
});

adoptionsRouter.post("/", (_request, response) => {
  response.status(501).json({ message: "Create tree adoption placeholder." });
});

adoptionsRouter.post("/:adoptionId/care-logs", (request, response) => {
  response.status(501).json({ message: `Log care for adoption ${request.params.adoptionId} placeholder.` });
});
