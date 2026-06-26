import { Router } from "express";

import { validateBody } from "../middleware/validate.js";
import { loginUser } from "../services/users.service.js";
import { loginSchema } from "../validators/auth.schemas.js";

export const authRouter = Router();

authRouter.post("/login", validateBody(loginSchema), async (request, response, next) => {
  try {
    response.json(await loginUser(request.body));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", (_request, response) => {
  response.status(204).send();
});
