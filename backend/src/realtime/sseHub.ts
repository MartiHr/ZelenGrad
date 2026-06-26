import { randomUUID } from "node:crypto";
import type { Response } from "express";

export type SseEvent =
  | "connected"
  | "adoption.care_logged"
  | "adoption.created"
  | "incident.created"
  | "incident.updated"
  | "maintenance.updated"
  | "asset.updated";

type SseClient = {
  id: string;
  response: Response;
};

class SseHub {
  private readonly clients = new Map<string, SseClient>();

  connect(response: Response) {
    const id = randomUUID();

    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    this.clients.set(id, { id, response });
    this.send(id, "connected", { clientId: id, connectedAt: new Date().toISOString() });

    const heartbeat = setInterval(() => {
      response.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    }, 25_000);

    return () => {
      clearInterval(heartbeat);
      this.clients.delete(id);
      response.end();
    };
  }

  broadcast(event: SseEvent, payload: unknown) {
    for (const client of this.clients.values()) {
      this.write(client.response, event, payload);
    }
  }

  private send(clientId: string, event: SseEvent, payload: unknown) {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    this.write(client.response, event, payload);
  }

  private write(response: Response, event: SseEvent, payload: unknown) {
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

export const sseHub = new SseHub();
