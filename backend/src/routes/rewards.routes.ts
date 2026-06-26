import { Router } from "express";

export const rewardsRouter = Router();

rewardsRouter.get("/", (_request, response) => {
  response.status(501).json({ message: "Read reward and green point balances placeholder." });
});

rewardsRouter.put("/:userId", (request, response) => {
  response.status(501).json({ message: `Adjust rewards for user ${request.params.userId} placeholder.` });
});
