import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";

type Asset = {
  id: string;
  type: string;
  commonName: string | null;
  species: string;
  description: string | null;
  latitude: string;
  longitude: string;
  plantedAt: string | null;
  healthStatus: string;
  lifecycleStatus: string;
  metadata: { photoUrl?: string } | null;
  zone: { id: string; name: string } | null;
  createdBy: { id: string; name: string; email: string } | null;
};

type AssetHistory = {
  healthLogs: Array<{
    id: string;
    status: string;
    source: string;
    notes: string | null;
    recordedAt: string;
  }>;
  maintenanceLogs: Array<{
    id: string;
    notes: string | null;
    resultingHealth: string | null;
    performedAt: string;
    employee: { id: string; name: string; email: string } | null;
    task: { id: string; title: string; type: string; status: string };
  }>;
};

type Adoption = {
  id: string;
  status: string;
  startedAt: string;
  asset: {
    id: string;
    commonName: string | null;
    species: string;
  };
};

const getAssetPhotoUrl = (asset: Asset) =>
  typeof asset.metadata?.photoUrl === "string" ? asset.metadata.photoUrl : "";

const formatDate = (value: string | null) => {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

export const AssetDetailsPage = () => {
  const { assetId } = useParams();
  const { hasRole, isAuthenticated, refreshUser, token } = useAuth();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<AssetHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adoptionError, setAdoptionError] = useState<string | null>(null);
  const [createdAdoption, setCreatedAdoption] = useState<Adoption | null>(null);
  const [isAdopting, setIsAdopting] = useState(false);

  useEffect(() => {
    if (!assetId) {
      setError("Asset id is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    Promise.all([
      apiRequest<Asset>(`/assets/${assetId}`),
      apiRequest<AssetHistory>(`/assets/${assetId}/history`)
    ])
      .then(([assetResponse, historyResponse]) => {
        setAsset(assetResponse);
        setHistory(historyResponse);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load asset details.");
      })
      .finally(() => setIsLoading(false));
  }, [assetId]);

  if (isLoading) {
    return (
      <section className="page">
        <h1>Asset Details</h1>
        <p>Loading asset details...</p>
      </section>
    );
  }

  if (error || !asset) {
    return (
      <section className="page narrow">
        <h1>Asset Details</h1>
        <p className="form-error">{error ?? "Asset not found."}</p>
        <Link to="/map">Back to map</Link>
      </section>
    );
  }

  const adoptTree = async () => {
    if (!token) {
      setAdoptionError("Please log in before adopting a tree.");
      return;
    }

    setIsAdopting(true);
    setAdoptionError(null);
    setCreatedAdoption(null);

    try {
      const adoption = await apiRequest<Adoption>("/adoptions", {
        method: "POST",
        token,
        body: {
          assetId: asset.id
        }
      });

      setCreatedAdoption(adoption);
      await refreshUser();
    } catch (caughtError) {
      setAdoptionError(caughtError instanceof ApiError ? caughtError.message : "Could not adopt this tree.");
    } finally {
      setIsAdopting(false);
    }
  };

  const latestHealthLog = history?.healthLogs[0] ?? null;
  const latestMaintenanceLog = history?.maintenanceLogs[0] ?? null;
  const assetPhotoUrl = getAssetPhotoUrl(asset);

  return (
    <section className="page">
      <div className="asset-detail-hero">
        <div className="asset-detail-media">
          {assetPhotoUrl ? (
            <img src={assetPhotoUrl} alt={asset.commonName ?? asset.species} />
          ) : (
            <div className="asset-detail-photo-placeholder">{asset.type.slice(0, 1)}</div>
          )}
        </div>
        <div className="asset-detail-summary">
          <div className="details-header">
            <div>
              <p className="eyebrow">{asset.type}</p>
              <h1>{asset.commonName ?? asset.species}</h1>
              <p>{asset.description ?? "No description has been added for this green asset yet."}</p>
            </div>
            <Link to="/map">Back to map</Link>
          </div>
          <div className="status-chip-row">
            <span className={`status-chip health-${asset.healthStatus.toLowerCase()}`}>{asset.healthStatus}</span>
            <span className="status-chip">{asset.lifecycleStatus}</span>
            <span className="status-chip">{asset.zone?.name ?? "Unassigned zone"}</span>
          </div>
          <dl className="asset-quick-stats">
            <div>
              <dt>Health records</dt>
              <dd>{history?.healthLogs.length ?? 0}</dd>
            </div>
            <div>
              <dt>Maintenance logs</dt>
              <dd>{history?.maintenanceLogs.length ?? 0}</dd>
            </div>
            <div>
              <dt>Last health update</dt>
              <dd>{latestHealthLog ? formatDate(latestHealthLog.recordedAt) : "Not recorded"}</dd>
            </div>
            <div>
              <dt>Last maintenance</dt>
              <dd>{latestMaintenanceLog ? formatDate(latestMaintenanceLog.performedAt) : "Not recorded"}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="details-grid">
        <article className="panel details-panel">
          <div className="panel-title-row">
            <h2>Registry</h2>
            {isAuthenticated && hasRole("EMPLOYEE", "MANAGER", "ADMIN") ? (
              <Link className="secondary-link" to={`/assets/${asset.id}/edit`}>
                Edit
              </Link>
            ) : null}
          </div>
          <dl>
            <div>
              <dt>Species</dt>
              <dd>{asset.species}</dd>
            </div>
            <div>
              <dt>Health</dt>
              <dd>{asset.healthStatus}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{asset.lifecycleStatus}</dd>
            </div>
            <div>
              <dt>Zone</dt>
              <dd>{asset.zone?.name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt>Coordinates</dt>
              <dd>
                {asset.latitude}, {asset.longitude}
              </dd>
            </div>
            <div>
              <dt>Planted</dt>
              <dd>{formatDate(asset.plantedAt)}</dd>
            </div>
            <div>
              <dt>Created by</dt>
              <dd>{asset.createdBy?.name ?? "Unknown"}</dd>
            </div>
          </dl>
        </article>

        <article className="panel details-panel">
          <h2>Actions</h2>
          <div className="action-stack">
            {isAuthenticated ? (
              <div className="action-section">
                <div>
                  <h3>Report Incident</h3>
                  <p className="muted-text">Send a field observation to the review queue.</p>
                </div>
                <div className="button-row">
                  <Link to={`/assets/${asset.id}/report`}>Report Incident</Link>
                </div>
              </div>
            ) : (
              <div className="auth-prompt">
                <p>Log in as a citizen to report damage, disease, waste, or other issues for this asset.</p>
                <div className="button-row">
                  <Link to="/login">Log in</Link>
                  <Link to="/register">Create account</Link>
                </div>
              </div>
            )}
            {isAuthenticated && hasRole("CITIZEN") ? (
              <div className="action-card">
                <div>
                  <h3>Citizen Care</h3>
                  <p className="muted-text">Adopt this tree and track care activity in My Forest.</p>
                </div>
                <button className="primary-action" type="button" disabled={isAdopting} onClick={() => void adoptTree()}>
                  {isAdopting ? "Adopting..." : "Adopt Tree"}
                </button>
                {adoptionError ? <p className="form-error">{adoptionError}</p> : null}
                {createdAdoption ? (
                  <p className="form-success">
                    Adopted {createdAdoption.asset.commonName ?? createdAdoption.asset.species}. View it in{" "}
                    <Link to="/my-forest">My Forest</Link>.
                  </p>
                ) : null}
              </div>
            ) : null}
            {isAuthenticated && hasRole("MANAGER", "ADMIN") ? (
              <div className="action-section">
                <div>
                  <h3>Schedule Maintenance</h3>
                  <p className="muted-text">
                    Leave assignee empty to place the task in the responsible zone worklist.
                  </p>
                </div>
                <div className="button-row">
                  <Link to={`/assets/${asset.id}/maintenance/new`}>Schedule Maintenance</Link>
                </div>
              </div>
            ) : null}
            {isAuthenticated && hasRole("EMPLOYEE") ? (
              <div className="auth-prompt">
                <p>Open your worklist to inspect assigned tasks or update maintenance progress.</p>
                <div className="button-row">
                  <Link to="/worklist">Open Worklist</Link>
                </div>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <section className="history-grid">
        <article className="panel details-panel">
          <h2>Health History</h2>
          {history?.healthLogs.length ? (
            <ul className="timeline">
              {history.healthLogs.map((log) => (
                <li key={log.id}>
                  <strong>{log.status}</strong>
                  <span>{formatDate(log.recordedAt)}</span>
                  <p>{log.notes ?? `Recorded from ${log.source}.`}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No health history has been recorded yet.</p>
          )}
        </article>

        <article className="panel details-panel">
          <h2>Maintenance Logs</h2>
          {history?.maintenanceLogs.length ? (
            <ul className="timeline">
              {history.maintenanceLogs.map((log) => (
                <li key={log.id}>
                  <strong>{log.task.title}</strong>
                  <span>{formatDate(log.performedAt)}</span>
                  <p>{log.notes ?? "No notes were added."}</p>
                  <small>
                    {log.employee?.name ?? "Unknown employee"}
                    {log.resultingHealth ? ` · Resulting health: ${log.resultingHealth}` : ""}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No maintenance logs have been recorded yet.</p>
          )}
        </article>
      </section>
    </section>
  );
};
