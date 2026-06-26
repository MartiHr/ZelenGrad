import { Router } from "express";

export const usersRouter = Router();

usersRouter.get("/", (_request, response) => {
  response.status(501).json({ message: "List/filter users placeholder for administrators." });
});

usersRouter.post("/", (_request, response) => {
  response.status(501).json({ message: "Create/register user placeholder." });
});

usersRouter.get("/:userId", (request, response) => {
  response.status(501).json({ message: `Read user ${request.params.userId} placeholder.` });
});

usersRouter.put("/:userId", (request, response) => {
  response.status(501).json({ message: `Update user ${request.params.userId} placeholder.` });
});

usersRouter.delete("/:userId", (request, response) => {
  response.status(501).json({ message: `Delete user ${request.params.userId} placeholder.` });
});
