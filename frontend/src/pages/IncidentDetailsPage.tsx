import { useEffect, useState, type FormEvent } from "react";
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

type GreenAsset = {
  id: string;
  commonName: string | null;
  species: string;
  healthStatus: string;
};

type Zone = {
  id: string;
  name: string;
};

type IncidentEditForm = {
  title: string;
  description: string;
  priority: string;
  assetId: string;
  zoneId: string;
  photoUrls: string;
};

const statuses = ["REPORTED", "VERIFIED", "IN_PROGRESS", "RESOLVED", "REJECTED"];
const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const createIncidentEditForm = (incident: Incident): IncidentEditForm => ({
  title: incident.title,
  description: incident.description,
  priority: incident.priority,
  assetId: incident.asset?.id ?? "",
  zoneId: incident.zone?.id ?? "",
  photoUrls: incident.photoUrls.join("\n")
});

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
  const [assets, setAssets] = useState<GreenAsset[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<IncidentEditForm | null>(null);

  useEffect(() => {
    if (!incidentId || !token) {
      setError("Incident id is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    apiRequest<Incident>(`/incidents/${incidentId}`, { token })
      .then((incidentResponse) => {
        setIncident(incidentResponse);
        setEditForm(createIncidentEditForm(incidentResponse));
      })
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load incident.");
      })
      .finally(() => setIsLoading(false));
  }, [incidentId, token]);

  useEffect(() => {
    Promise.all([apiRequest<GreenAsset[]>("/assets"), apiRequest<Zone[]>("/zones")])
      .then(([assetsResponse, zonesResponse]) => {
        setAssets(assetsResponse);
        setZones(zonesResponse);
      })
      .catch(() => {
        setAssets([]);
        setZones([]);
      });
  }, []);

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

  const updateEditForm = (patch: Partial<IncidentEditForm>) => {
    setEditForm((current) => (current ? { ...current, ...patch } : current));
  };

  const saveIncident = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!incident || !token || !editForm) {
      return;
    }

    setIsSaving(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      const photoUrls = editForm.photoUrls
        .split("\n")
        .map((photoUrl) => photoUrl.trim())
        .filter(Boolean);

      const updatedIncident = await apiRequest<Incident>(`/incidents/${incident.id}`, {
        method: "PUT",
        token,
        body: {
          title: editForm.title,
          description: editForm.description,
          priority: editForm.priority,
          assetId: editForm.assetId || null,
          zoneId: editForm.zoneId || null,
          photoUrls
        }
      });

      setIncident(updatedIncident);
      setEditForm(createIncidentEditForm(updatedIncident));
      setEditSuccess("Incident details updated.");
    } catch (caughtError) {
      setEditError(caughtError instanceof ApiError ? caughtError.message : "Could not update incident details.");
    } finally {
      setIsSaving(false);
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

      {editForm ? (
        <article className="panel details-panel">
          <h2>Triage Editor</h2>
          <form className="inline-form asset-form" onSubmit={(event) => void saveIncident(event)}>
            <div className="form-grid">
              <label>
                Priority
                <select value={editForm.priority} onChange={(event) => updateEditForm({ priority: event.target.value })}>
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Linked asset
                <select value={editForm.assetId} onChange={(event) => updateEditForm({ assetId: event.target.value })}>
                  <option value="">Unlinked</option>
                  {incident.asset && !assets.some((asset) => asset.id === incident.asset?.id) ? (
                    <option value={incident.asset.id}>
                      {incident.asset.commonName ?? incident.asset.species}
                    </option>
                  ) : null}
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.commonName ?? asset.species}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Zone
                <select value={editForm.zoneId} onChange={(event) => updateEditForm({ zoneId: event.target.value })}>
                  <option value="">Unassigned</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input
                  value={editForm.title}
                  onChange={(event) => updateEditForm({ title: event.target.value })}
                  minLength={3}
                  maxLength={160}
                  required
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                value={editForm.description}
                onChange={(event) => updateEditForm({ description: event.target.value })}
                minLength={10}
                maxLength={2000}
                required
              />
            </label>
            <label>
              Photo URLs
              <textarea
                value={editForm.photoUrls}
                onChange={(event) => updateEditForm({ photoUrls: event.target.value })}
                placeholder="https://example.com/photo.jpg"
              />
            </label>

            {editError ? <p className="form-error">{editError}</p> : null}
            {editSuccess ? <p className="form-success">{editSuccess}</p> : null}

            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Incident"}
            </button>
          </form>
        </article>
      ) : null}

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
