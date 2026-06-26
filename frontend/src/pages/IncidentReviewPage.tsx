import { useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";

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

const statuses = ["REPORTED", "VERIFIED", "IN_PROGRESS", "RESOLVED", "REJECTED"];

export const IncidentReviewPage = () => {
  const { token } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();

    if (status) {
      params.set("status", status);
    }

    const value = params.toString();
    return value ? `?${value}` : "";
  }, [status]);

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
            {statuses.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="incident-list">
        {isLoading ? <p>Loading incidents...</p> : null}
        {!isLoading && incidents.length === 0 ? <p>No incidents match the current filters.</p> : null}
        {incidents.map((incident) => (
          <article className="incident-card" key={incident.id}>
            <header>
              <div>
                <p className="eyebrow">{incident.type}</p>
                <h2>{incident.title}</h2>
              </div>
              <span className={`badge ${incident.priority.toLowerCase()}`}>{incident.priority}</span>
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
            </dl>
            <div className="button-row">
              {statuses.map((statusOption) => (
                <button
                  key={statusOption}
                  type="button"
                  disabled={updatingId === incident.id || incident.status === statusOption}
                  onClick={() => void updateIncidentStatus(incident.id, statusOption)}
                >
                  {statusOption}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
