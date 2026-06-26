import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { ApiError, apiRequest } from "../api";

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
  const [asset, setAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<AssetHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <section className="page">
      <div className="details-header">
        <div>
          <p className="eyebrow">{asset.type}</p>
          <h1>{asset.commonName ?? asset.species}</h1>
          <p>{asset.description ?? "No description has been added for this green asset yet."}</p>
        </div>
        <Link to="/map">Back to map</Link>
      </div>

      <div className="details-grid">
        <article className="panel details-panel">
          <h2>Registry</h2>
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
            <button type="button" disabled>
              Report Incident
            </button>
            <button type="button" disabled>
              Adopt Tree
            </button>
            <button type="button" disabled>
              Schedule Maintenance
            </button>
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
