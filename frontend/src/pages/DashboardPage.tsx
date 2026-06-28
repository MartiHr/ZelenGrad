import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import { ApiError, apiRequest, createDashboardEventSource } from "../api";
import { useAuth } from "../auth/AuthContext";
import { StaffSearchSelect } from "../components/StaffSearchSelect";

type DashboardEvent = {
  type: string;
  payload: string;
  receivedAt: string;
};

type CountMap = Record<string, number>;

type Zone = {
  id: string;
  name: string;
};

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type DashboardSummary = {
  generatedAt: string;
  filters: {
    zoneId: string | null;
    responsibleEmployeeId: string | null;
    timeWindow: string;
    since: string | null;
  };
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

const timeWindows = [
  { value: "ALL", label: "All time" },
  { value: "TODAY", label: "Today" },
  { value: "7D", label: "Last 7 days" },
  { value: "30D", label: "Last 30 days" }
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

const getWindowLabel = (timeWindow: string) =>
  timeWindows.find((windowOption) => windowOption.value === timeWindow)?.label.toLowerCase() ?? "selected window";

const getPayload = (data: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(data);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const textValue = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

const formatRelativeTime = (value: string) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));

  if (seconds < 10) {
    return "just now";
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
};

const getEventCategory = (type: string) => {
  if (type.startsWith("incident")) {
    return "incident";
  }

  if (type.startsWith("maintenance")) {
    return "maintenance";
  }

  if (type.startsWith("adoption")) {
    return "adoption";
  }

  if (type.startsWith("asset")) {
    return "asset";
  }

  return "system";
};

const describeEvent = (event: DashboardEvent) => {
  const payload = getPayload(event.payload);
  const title = textValue(payload.title);
  const assetName = textValue(payload.assetName);
  const status = textValue(payload.status);
  const action = textValue(payload.action);

  switch (event.type) {
    case "connected":
      return {
        title: "Live connection ready",
        detail: "Dashboard is listening for city updates."
      };
    case "incident.created":
      return {
        title: "New incident reported",
        detail: title ? `${title}${status ? ` is ${status.toLowerCase()}` : ""}.` : "A citizen report entered the review queue."
      };
    case "incident.updated":
      return {
        title: "Incident updated",
        detail: title ? `${title}${status ? ` moved to ${status.toLowerCase()}` : " changed"}.` : "Incident review status changed."
      };
    case "maintenance.updated":
      return {
        title: "Maintenance updated",
        detail: title ? `${title}${status ? ` is ${status.toLowerCase()}` : " changed"}.` : "A maintenance task changed."
      };
    case "adoption.created":
      return {
        title: "Tree adopted",
        detail: assetName ? `${assetName} has a new caretaker.` : "A tree has been adopted."
      };
    case "adoption.care_logged":
      return {
        title: "Care logged",
        detail: assetName ? `Care activity was logged for ${assetName}.` : "A citizen logged care activity."
      };
    case "asset.updated":
      return {
        title: "Asset registry updated",
        detail: action ? `A green asset was ${action}.` : "A green asset changed."
      };
    default:
      return {
        title: "Live update",
        detail: "Dashboard data changed."
      };
  }
};

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
  const [zones, setZones] = useState<Zone[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [responsibleEmployeeId, setResponsibleEmployeeId] = useState("");
  const [timeWindow, setTimeWindow] = useState("ALL");
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    if (!token) {
      return;
    }

    setError(null);

    try {
      const params = new URLSearchParams();

      if (zoneId) {
        params.set("zoneId", zoneId);
      }

      if (responsibleEmployeeId) {
        params.set("responsibleEmployeeId", responsibleEmployeeId);
      }

      params.set("timeWindow", timeWindow);

      setSummary(await apiRequest<DashboardSummary>(`/dashboard/summary?${params.toString()}`, { token }));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not load dashboard summary.");
    } finally {
      setIsLoading(false);
    }
  }, [responsibleEmployeeId, timeWindow, token, zoneId]);

  useEffect(() => {
    setIsLoading(true);
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    apiRequest<Zone[]>("/zones")
      .then(setZones)
      .catch(() => setZones([]));
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    apiRequest<StaffUser[]>("/users/staff", { token })
      .then(setStaffUsers)
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load staff users.");
      });
  }, [token]);

  useEffect(() => {
    const source = createDashboardEventSource();

    for (const type of eventTypes) {
      source.addEventListener(type, (event) => {
        setEvents((current) => [{ type, payload: event.data, receivedAt: new Date().toISOString() }, ...current].slice(0, 10));

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
  const windowLabel = getWindowLabel(timeWindow);

  return (
    <section className="page">
      <div className="details-header">
        <div>
          <h1><FontAwesomeIcon icon={["fas", "gauge-high"]} /> Live Dashboard</h1>
          <p>Operational snapshot for assets, incidents, maintenance workload, adoptions, and real-time changes.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void loadSummary()}>
          Refresh
        </button>
      </div>

      <div className="toolbar">
        <label>
          Zone
          <select value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
            <option value="">All zones</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Responsible staff
          <StaffSearchSelect
            value={responsibleEmployeeId}
            onChange={setResponsibleEmployeeId}
            staffUsers={staffUsers}
            placeholder="Any responsible staff"
          />
        </label>
        <label>
          Time window
          <select value={timeWindow} onChange={(event) => setTimeWindow(event.target.value)}>
            {timeWindows.map((windowOption) => (
              <option key={windowOption.value} value={windowOption.value}>
                {windowOption.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? <p>Loading dashboard summary...</p> : null}

      {summary ? (
        <>
          <section className="stat-grid" aria-label="Dashboard metrics">
            <StatCard
              label="Active assets"
              value={summary.assets.active}
              detail={`${summary.assets.total} registered in ${windowLabel}`}
            />
            <StatCard label="Open incidents" value={summary.incidents.open} detail={`${summary.incidents.urgentOpen} urgent`} />
            <StatCard
              label="Open tasks"
              value={openMaintenance}
              detail={`${summary.maintenance.due} due now, ${summary.maintenance.completedToday} completed in ${windowLabel}`}
            />
            <StatCard
              label="Active adoptions"
              value={summary.adoptions.active}
              detail={`${summary.adoptions.careLogsToday} care logs in ${windowLabel}`}
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
              <div className="live-activity-header">
                <div>
                  <h2>Live Activity</h2>
                  <p className="muted-text">Latest SSE updates translated into operational events.</p>
                </div>
                <span>{events.length} recent</span>
              </div>
              {events.length === 0 ? (
                <p>No live events yet.</p>
              ) : (
                <ul className="event-list">
                  {events.map((event, index) => {
                    const eventDescription = describeEvent(event);
                    const category = getEventCategory(event.type);

                    return (
                      <li className={`event-item event-${category}`} key={`${event.type}-${event.receivedAt}-${index}`}>
                        <span className="event-dot" aria-hidden="true" />
                        <div>
                          <strong>{eventDescription.title}</strong>
                          <p>{eventDescription.detail}</p>
                          <small>
                            {formatRelativeTime(event.receivedAt)} | {event.type}
                          </small>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          </section>

          <p className="muted-text">
            Last refreshed {formatDateTime(summary.generatedAt)}. Showing {getWindowLabel(summary.filters.timeWindow)}
            {summary.filters.zoneId ? " for selected zone" : ""}
            {summary.filters.responsibleEmployeeId ? " and selected responsible staff" : ""}.
          </p>
        </>
      ) : null}
    </section>
  );
};
