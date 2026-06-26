import { Router } from "express";

export const assetsRouter = Router();

assetsRouter.get("/", (_request, response) => {
  response.status(501).json({ message: "List green assets for public map placeholder." });
});

assetsRouter.post("/", (_request, response) => {
  response.status(501).json({ message: "Create green asset placeholder for employee/manager/admin roles." });
});

assetsRouter.get("/:assetId", (request, response) => {
  response.status(501).json({ message: `Read asset ${request.params.assetId} placeholder.` });
});

assetsRouter.put("/:assetId", (request, response) => {
  response.status(501).json({ message: `Update asset ${request.params.assetId} placeholder.` });
});

assetsRouter.delete("/:assetId", (request, response) => {
  response.status(501).json({ message: `Archive/delete asset ${request.params.assetId} placeholder.` });
});

assetsRouter.get("/:assetId/history", (request, response) => {
  response.status(501).json({ message: `Asset ${request.params.assetId} history placeholder.` });
});
