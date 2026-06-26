import { useEffect, useState } from "react";

import { createDashboardEventSource } from "../api";

type DashboardEvent = {
  type: string;
  payload: string;
};

export const DashboardPage = () => {
  const [events, setEvents] = useState<DashboardEvent[]>([]);

  useEffect(() => {
    const source = createDashboardEventSource();
    const eventTypes = [
      "connected",
      "adoption.created",
      "incident.created",
      "incident.updated",
      "maintenance.updated",
      "asset.updated"
    ];

    for (const type of eventTypes) {
      source.addEventListener(type, (event) => {
        setEvents((current) => [{ type, payload: event.data }, ...current].slice(0, 10));
      });
    }

    return () => source.close();
  }, []);

  return (
    <section className="page">
      <h1>Live Dashboard</h1>
      <p>Real-time adoption, incident, maintenance, and asset stream for managers and administrators.</p>
      <div className="panel">
        {events.length === 0 ? (
          <p>No live events yet.</p>
        ) : (
          <ul className="event-list">
            {events.map((event, index) => (
              <li key={`${event.type}-${index}`}>
                <strong>{event.type}</strong>
                <code>{event.payload}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
