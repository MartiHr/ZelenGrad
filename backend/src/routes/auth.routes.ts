import { Router } from "express";

export const authRouter = Router();

authRouter.post("/login", (_request, response) => {
  response.status(501).json({
    message: "Login endpoint placeholder. Add credential validation and token issuing here."
  });
});

authRouter.post("/logout", (_request, response) => {
  response.status(501).json({
    message: "Logout endpoint placeholder. Add token/session invalidation here."
  });
});
