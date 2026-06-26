import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";

type Incident = {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  photoUrls: string[];
  latitude: string | null;
  longitude: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  resolvedAt: string | null;
  asset: { id: string; commonName: string | null; species: string; healthStatus: string } | null;
  zone: { id: string; name: string } | null;
  reporter: { id: string; name: string; email: string } | null;
  verifiedBy: { id: string; name: string; email: string } | null;
};

const statuses = ["REPORTED", "VERIFIED", "IN_PROGRESS", "RESOLVED", "REJECTED"];

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

export const IncidentDetailsPage = () => {
  const { incidentId } = useParams();
  const { token } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!incidentId || !token) {
      setError("Incident id is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    apiRequest<Incident>(`/incidents/${incidentId}`, { token })
      .then(setIncident)
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load incident.");
      })
      .finally(() => setIsLoading(false));
  }, [incidentId, token]);

  const updateIncidentStatus = async (status: string) => {
    if (!incident || !token) {
      return;
    }

    setUpdatingStatus(status);
    setError(null);

    try {
      setIncident(
        await apiRequest<Incident>(`/incidents/${incident.id}`, {
          method: "PUT",
          token,
          body: { status }
        })
      );
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not update incident.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (isLoading) {
    return (
      <section className="page">
        <h1>Incident Details</h1>
        <p>Loading incident...</p>
      </section>
    );
  }

  if (error || !incident) {
    return (
      <section className="page narrow">
        <h1>Incident Details</h1>
        <p className="form-error">{error ?? "Incident not found."}</p>
        <Link className="text-link" to="/incidents">
          Back to incidents
        </Link>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="details-header">
        <div>
          <p className="eyebrow">{incident.type}</p>
          <h1>{incident.title}</h1>
          <p>{incident.description}</p>
        </div>
        <Link to="/incidents">Back to incidents</Link>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="details-grid">
        <article className="panel details-panel">
          <h2>Review</h2>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{incident.status}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{incident.priority}</dd>
            </div>
            <div>
              <dt>Reported</dt>
              <dd>{formatDateTime(incident.createdAt)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDateTime(incident.updatedAt)}</dd>
            </div>
            <div>
              <dt>Verified</dt>
              <dd>{formatDateTime(incident.verifiedAt)}</dd>
            </div>
            <div>
              <dt>Resolved</dt>
              <dd>{formatDateTime(incident.resolvedAt)}</dd>
            </div>
          </dl>
          <div className="button-row">
            {statuses.map((status) => (
              <button
                key={status}
                type="button"
                disabled={updatingStatus !== null || incident.status === status}
                onClick={() => void updateIncidentStatus(status)}
              >
                {updatingStatus === status ? "Updating..." : status}
              </button>
            ))}
          </div>
        </article>

        <article className="panel details-panel">
          <h2>Context</h2>
          <dl>
            <div>
              <dt>Asset</dt>
              <dd>
                {incident.asset ? (
                  <Link className="text-link" to={`/assets/${incident.asset.id}`}>
                    {incident.asset.commonName ?? incident.asset.species}
                  </Link>
                ) : (
                  "Unlinked"
                )}
              </dd>
            </div>
            <div>
              <dt>Asset health</dt>
              <dd>{incident.asset?.healthStatus ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Zone</dt>
              <dd>{incident.zone?.name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt>Reporter</dt>
              <dd>{incident.reporter ? `${incident.reporter.name} (${incident.reporter.email})` : "Unknown"}</dd>
            </div>
            <div>
              <dt>Verified by</dt>
              <dd>{incident.verifiedBy ? `${incident.verifiedBy.name} (${incident.verifiedBy.email})` : "Not verified"}</dd>
            </div>
            <div>
              <dt>Coordinates</dt>
              <dd>
                {incident.latitude && incident.longitude
                  ? `${incident.latitude}, ${incident.longitude}`
                  : "Not recorded"}
              </dd>
            </div>
          </dl>
        </article>
      </div>

      <article className="panel details-panel">
        <h2>Evidence</h2>
        {incident.photoUrls.length ? (
          <div className="photo-links">
            {incident.photoUrls.map((photoUrl) => (
              <a href={photoUrl} key={photoUrl} rel="noreferrer" target="_blank">
                Photo
              </a>
            ))}
          </div>
        ) : (
          <p>No photo evidence was submitted.</p>
        )}
      </article>
    </section>
  );
};
