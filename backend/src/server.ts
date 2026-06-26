import { createServer } from "node:http";

import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { createApp } from "./app.js";

const app = createApp();
const server = createServer(app);

server.listen(env.port, () => {
  console.log(`ZelenGrad API listening on http://localhost:${env.port}`);
});

const shutdown = async (signal: NodeJS.Signals) => {
  console.log(`${signal} received. Closing ZelenGrad API.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
