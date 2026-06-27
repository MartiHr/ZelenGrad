import cors from "cors";
import express from "express";
import morgan from "morgan";
import path from "node:path";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { apiRouter } from "./routes/index.js";

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: env.frontendOrigin, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
