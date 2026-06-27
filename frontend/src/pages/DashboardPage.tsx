import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import { ApiError, apiRequest, createDashboardEventSource } from "../api";
import { useAuth } from "../auth/AuthContext";

type DashboardEvent = {
  type: string;
  payload: string;
};

type CountMap = Record<string, number>;

type DashboardSummary = {
  generatedAt: string;
  assets: {
    total: number;
    active: number;
    byHealth: CountMap;
  };
  incidents: {
    open: number;
    urgentOpen: number;
    byStatus: CountMap;
  };
  maintenance: {
    due: number;
    completedToday: number;
    byStatus: CountMap;
  };
  adoptions: {
    active: number;
    careLogsToday: number;
  };
  recent: {
    incidents: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      updatedAt: string;
      zone: { id: string; name: string } | null;
      asset: { id: string; commonName: string | null; species: string } | null;
    }>;
    maintenanceTasks: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      dueAt: string | null;
      updatedAt: string;
      assignedTo: { id: string; name: string; email: string } | null;
      asset: { id: string; commonName: string | null; species: string } | null;
      zone: { id: string; name: string } | null;
    }>;
    adoptions: Array<{
      id: string;
      status: string;
      startedAt: string;
      updatedAt: string;
      user: { id: string; name: string; email: string };
      asset: { id: string; commonName: string | null; species: string };
      _count: { careLogs: number };
    }>;
  };
};

const eventTypes = [
  "connected",
  "adoption.care_logged",
  "adoption.created",
  "incident.created",
  "incident.updated",
  "maintenance.updated",
  "asset.updated"
];

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const sumCounts = (counts: CountMap, keys: string[]) => keys.reduce((total, key) => total + (counts[key] ?? 0), 0);

const StatCard = ({ label, value, detail }: { label: string; value: number; detail: string }) => (
  <article className="stat-card">
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{detail}</small>
  </article>
);

const CountList = ({ counts }: { counts: CountMap }) => (
  <dl className="count-list">
    {Object.entries(counts).map(([label, value]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    ))}
  </dl>
);

export const DashboardPage = () => {
  const { token } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    if (!token) {
      return;
    }

    setError(null);

    try {
      setSummary(await apiRequest<DashboardSummary>("/dashboard/summary", { token }));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not load dashboard summary.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const source = createDashboardEventSource();

    for (const type of eventTypes) {
      source.addEventListener(type, (event) => {
        setEvents((current) => [{ type, payload: event.data }, ...current].slice(0, 10));

        if (type !== "connected") {
          void loadSummary();
        }
      });
    }

    return () => source.close();
  }, [loadSummary]);

  const openMaintenance = summary
    ? sumCounts(summary.maintenance.byStatus, ["PLANNED", "ASSIGNED", "IN_PROGRESS"])
    : 0;

  return (
    <section className="page">
      <div className="details-header">
        <div>
          <h1>Live Dashboard</h1>
          <p>Operational snapshot for assets, incidents, maintenance workload, adoptions, and real-time changes.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void loadSummary()}>
          Refresh
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? <p>Loading dashboard summary...</p> : null}

      {summary ? (
        <>
          <section className="stat-grid" aria-label="Dashboard metrics">
            <StatCard label="Active assets" value={summary.assets.active} detail={`${summary.assets.total} total registered`} />
            <StatCard label="Open incidents" value={summary.incidents.open} detail={`${summary.incidents.urgentOpen} urgent`} />
            <StatCard label="Open tasks" value={openMaintenance} detail={`${summary.maintenance.due} due now`} />
            <StatCard
              label="Active adoptions"
              value={summary.adoptions.active}
              detail={`${summary.adoptions.careLogsToday} care logs today`}
            />
          </section>

          <section className="dashboard-grid">
            <article className="panel details-panel">
              <h2>Asset Health</h2>
              <CountList counts={summary.assets.byHealth} />
            </article>

            <article className="panel details-panel">
              <h2>Incident Status</h2>
              <CountList counts={summary.incidents.byStatus} />
            </article>

            <article className="panel details-panel">
              <h2>Maintenance Status</h2>
              <CountList counts={summary.maintenance.byStatus} />
            </article>
          </section>

          <section className="history-grid">
            <article className="panel details-panel">
              <h2>Recent Incidents</h2>
              {summary.recent.incidents.length ? (
                <ul className="timeline">
                  {summary.recent.incidents.map((incident) => (
                    <li key={incident.id}>
                      <Link className="text-link" to={`/incidents/${incident.id}`}>
                        {incident.title}
                      </Link>
                      <span>
                        {incident.status} | {incident.priority} | {formatDateTime(incident.updatedAt)}
                      </span>
                      <small>{incident.asset?.commonName ?? incident.asset?.species ?? incident.zone?.name ?? "Unlinked"}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No incidents have been reported yet.</p>
              )}
            </article>

            <article className="panel details-panel">
              <h2>Recent Maintenance</h2>
              {summary.recent.maintenanceTasks.length ? (
                <ul className="timeline">
                  {summary.recent.maintenanceTasks.map((task) => (
                    <li key={task.id}>
                      <Link className="text-link" to={`/worklist/${task.id}`}>
                        {task.title}
                      </Link>
                      <span>
                        {task.status} | {task.priority} | due {formatDateTime(task.dueAt)}
                      </span>
                      <small>
                        {task.assignedTo?.name ?? "Unassigned"} |{" "}
                        {task.asset?.commonName ?? task.asset?.species ?? task.zone?.name ?? "Zone task"}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No maintenance tasks have been created yet.</p>
              )}
            </article>

            <article className="panel details-panel">
              <h2>Recent Adoptions</h2>
              {summary.recent.adoptions.length ? (
                <ul className="timeline">
                  {summary.recent.adoptions.map((adoption) => (
                    <li key={adoption.id}>
                      <Link className="text-link" to={`/assets/${adoption.asset.id}`}>
                        {adoption.asset.commonName ?? adoption.asset.species}
                      </Link>
                      <span>
                        {adoption.status} | {adoption._count.careLogs} care logs
                      </span>
                      <small>
                        {adoption.user.name} | started {formatDateTime(adoption.startedAt)}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No trees have been adopted yet.</p>
              )}
            </article>

            <article className="panel details-panel">
              <h2>Live Activity</h2>
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
            </article>
          </section>

          <p className="muted-text">Last refreshed {formatDateTime(summary.generatedAt)}.</p>
        </>
      ) : null}
    </section>
  );
};
