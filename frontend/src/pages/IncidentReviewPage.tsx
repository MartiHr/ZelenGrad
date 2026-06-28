import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import { StaffSearchSelect } from "../components/StaffSearchSelect";
import { getNextIncidentStatuses, incidentStatusHints, incidentStatuses } from "../incidents/statusFlow";

type Incident = {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  asset: { id: string; commonName: string | null; species: string; healthStatus: string } | null;
  zone: { id: string; name: string } | null;
  reporter: { id: string; name: string; email: string } | null;
  verifiedBy: { id: string; name: string; email: string } | null;
};

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

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const IncidentReviewPage = () => {
  const { hasRole, token } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [responsibleEmployeeId, setResponsibleEmployeeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const canManageIncidents = hasRole("MANAGER", "ADMIN");

  const query = useMemo(() => {
    const params = new URLSearchParams();

    if (status) {
      params.set("status", status);
    }

    if (priority) {
      params.set("priority", priority);
    }

    if (zoneId) {
      params.set("zoneId", zoneId);
    }

    if (canManageIncidents && responsibleEmployeeId) {
      params.set("responsibleEmployeeId", responsibleEmployeeId);
    }

    const value = params.toString();
    return value ? `?${value}` : "";
  }, [canManageIncidents, priority, responsibleEmployeeId, status, zoneId]);

  const loadIncidents = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setIncidents(await apiRequest<Incident[]>(`/incidents${query}`, { token }));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not load incidents.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadIncidents();
  }, [query, token]);

  useEffect(() => {
    apiRequest<Zone[]>("/zones")
      .then(setZones)
      .catch(() => setZones([]));
  }, []);

  useEffect(() => {
    if (!token || !canManageIncidents) {
      setStaffUsers([]);
      return;
    }

    apiRequest<StaffUser[]>("/users/staff", { token })
      .then(setStaffUsers)
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load staff users.");
      });
  }, [canManageIncidents, token]);

  const updateIncidentStatus = async (incidentId: string, nextStatus: string) => {
    if (!token) {
      return;
    }

    setUpdatingId(incidentId);
    setError(null);

    try {
      const updatedIncident = await apiRequest<Incident>(`/incidents/${incidentId}`, {
        method: "PUT",
        token,
        body: { status: nextStatus }
      });
      setIncidents((current) => current.map((incident) => (incident.id === incidentId ? updatedIncident : incident)));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not update incident.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="page">
      <h1>Incident Review</h1>
      <p>Verify, prioritize, and resolve citizen reports from the field.</p>

      <div className="toolbar">
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            {incidentStatuses.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">All</option>
            {priorities.map((priorityOption) => (
              <option key={priorityOption} value={priorityOption}>
                {priorityOption}
              </option>
            ))}
          </select>
        </label>
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
        {canManageIncidents ? (
          <label>
            Responsible zone
            <StaffSearchSelect
              value={responsibleEmployeeId}
              onChange={setResponsibleEmployeeId}
              staffUsers={staffUsers}
              placeholder="Any responsible staff"
            />
          </label>
        ) : (
          <div className="field-action">
            <span>Scope</span>
            <strong>My responsible zones</strong>
          </div>
        )}
      </div>

      {canManageIncidents && incidents.length ? (
        <div className="dashboard-grid">
          <article className="panel details-panel">
            <h2>By Zone</h2>
            <dl className="count-list">
              {Object.entries(
                incidents.reduce<Record<string, number>>((counts, incident) => {
                  const key = incident.zone?.name ?? "Unassigned";
                  return { ...counts, [key]: (counts[key] ?? 0) + 1 };
                }, {})
              ).map(([label, count]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
          </article>
          <article className="panel details-panel">
            <h2>By Priority</h2>
            <dl className="count-list">
              {Object.entries(
                incidents.reduce<Record<string, number>>((counts, incident) => {
                  return { ...counts, [incident.priority]: (counts[incident.priority] ?? 0) + 1 };
                }, {})
              ).map(([label, count]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
          </article>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="worklist-summary">
        <span>{incidents.length} visible incidents</span>
        <span>{incidents.filter((incident) => incident.status === "REPORTED").length} reported</span>
        <span>{incidents.filter((incident) => incident.status === "IN_PROGRESS").length} in progress</span>
        <span>{incidents.filter((incident) => incident.priority === "URGENT").length} urgent</span>
      </div>

      <div className="incident-list">
        {isLoading ? <p>Loading incidents...</p> : null}
        {!isLoading && incidents.length === 0 ? <p>No incidents match the current filters.</p> : null}
        {incidents.map((incident) => {
          const nextStatuses = getNextIncidentStatuses(incident.status);
          const isUpdating = updatingId === incident.id;

          return (
          <article className={`incident-card status-${incident.status.toLowerCase()}`} key={incident.id}>
            <header>
              <div>
                <p className="eyebrow">{incident.type}</p>
                <h2>{incident.title}</h2>
                <p className="muted-text">{incidentStatusHints[incident.status] ?? "Incident report"}</p>
              </div>
              <div className="task-chip-row">
                <span className={`badge status-badge ${incident.status.toLowerCase()}`}>{incident.status}</span>
                <span className={`badge ${incident.priority.toLowerCase()}`}>{incident.priority}</span>
              </div>
            </header>
            <p>{incident.description}</p>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{incident.status}</dd>
              </div>
              <div>
                <dt>Asset</dt>
                <dd>{incident.asset?.commonName ?? incident.asset?.species ?? "Unlinked"}</dd>
              </div>
              <div>
                <dt>Zone</dt>
                <dd>{incident.zone?.name ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt>Reporter</dt>
                <dd>{incident.reporter?.name ?? "Unknown"}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(incident.updatedAt))}</dd>
              </div>
            </dl>
            <div className="button-row">
              <Link to={`/incidents/${incident.id}`}>Open details</Link>
              {nextStatuses.map((statusOption) => (
                <button
                  key={statusOption}
                  type="button"
                  disabled={updatingId === incident.id || incident.status === statusOption}
                  onClick={() => void updateIncidentStatus(incident.id, statusOption)}
                >
                  {isUpdating ? "Updating..." : statusOption}
                </button>
              ))}
              {nextStatuses.length === 0 ? <span className="muted-text">No status actions available.</span> : null}
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
};
