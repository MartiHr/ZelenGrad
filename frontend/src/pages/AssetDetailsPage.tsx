import { useEffect, useState, type FormEvent } from "react";
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

type CreatedIncident = {
  id: string;
  type: string;
  priority: string;
  title: string;
  status: string;
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

type MaintenanceTask = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
};

const incidentTypes = [
  "DRY_TREE",
  "VANDALISM",
  "DISEASE",
  "FALLEN_BRANCH",
  "WASTE",
  "OTHER"
];

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const maintenanceTypes = ["WATERING", "PRUNING", "INSPECTION", "TREATMENT", "CLEANUP", "REMOVAL", "OTHER"];

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
  const [reportType, setReportType] = useState("DRY_TREE");
  const [reportPriority, setReportPriority] = useState("MEDIUM");
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [createdIncident, setCreatedIncident] = useState<CreatedIncident | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [adoptionError, setAdoptionError] = useState<string | null>(null);
  const [createdAdoption, setCreatedAdoption] = useState<Adoption | null>(null);
  const [isAdopting, setIsAdopting] = useState(false);
  const [maintenanceType, setMaintenanceType] = useState("INSPECTION");
  const [maintenancePriority, setMaintenancePriority] = useState("MEDIUM");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceDescription, setMaintenanceDescription] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [createdMaintenanceTask, setCreatedMaintenanceTask] = useState<MaintenanceTask | null>(null);
  const [isSchedulingMaintenance, setIsSchedulingMaintenance] = useState(false);

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

  const submitIncidentReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setReportError("Please log in before reporting an incident.");
      return;
    }

    setIsSubmittingReport(true);
    setReportError(null);
    setCreatedIncident(null);

    try {
      const incident = await apiRequest<CreatedIncident>("/incidents", {
        method: "POST",
        token,
        body: {
          type: reportType,
          priority: reportPriority,
          title: reportTitle,
          description: reportDescription,
          assetId: asset.id,
          zoneId: asset.zone?.id,
          latitude: asset.latitude,
          longitude: asset.longitude
        }
      });

      setCreatedIncident(incident);
      setReportTitle("");
      setReportDescription("");
      setReportPriority("MEDIUM");
    } catch (caughtError) {
      setReportError(caughtError instanceof ApiError ? caughtError.message : "Could not submit incident report.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

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

  const scheduleMaintenance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setMaintenanceError("Please log in before scheduling maintenance.");
      return;
    }

    setIsSchedulingMaintenance(true);
    setMaintenanceError(null);
    setCreatedMaintenanceTask(null);

    try {
      const task = await apiRequest<MaintenanceTask>("/maintenance", {
        method: "POST",
        token,
        body: {
          title: maintenanceTitle,
          description: maintenanceDescription.trim() || undefined,
          type: maintenanceType,
          priority: maintenancePriority,
          scheduledFor: scheduledFor || undefined,
          dueAt: dueAt || undefined,
          assetId: asset.id,
          zoneId: asset.zone?.id
        }
      });

      setCreatedMaintenanceTask(task);
      setMaintenanceTitle("");
      setMaintenanceDescription("");
      setScheduledFor("");
      setDueAt("");
      setMaintenanceType("INSPECTION");
      setMaintenancePriority("MEDIUM");
    } catch (caughtError) {
      setMaintenanceError(
        caughtError instanceof ApiError ? caughtError.message : "Could not schedule maintenance task."
      );
    } finally {
      setIsSchedulingMaintenance(false);
    }
  };

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
            {isAuthenticated ? (
              <form className="inline-form" onSubmit={(event) => void submitIncidentReport(event)}>
                <label>
                  Incident type
                  <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
                    {incidentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Priority
                  <select value={reportPriority} onChange={(event) => setReportPriority(event.target.value)}>
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Title
                  <input
                    value={reportTitle}
                    onChange={(event) => setReportTitle(event.target.value)}
                    minLength={3}
                    maxLength={160}
                    required
                    placeholder="Dry branches near sidewalk"
                  />
                </label>

                <label>
                  Description
                  <textarea
                    value={reportDescription}
                    onChange={(event) => setReportDescription(event.target.value)}
                    minLength={10}
                    maxLength={2000}
                    required
                    placeholder="Describe what you noticed and where it is visible."
                  />
                </label>

                {reportError ? <p className="form-error">{reportError}</p> : null}
                {createdIncident ? (
                  <p className="form-success">
                    Incident {createdIncident.status.toLowerCase()} as {createdIncident.title}.
                  </p>
                ) : null}

                <button type="submit" disabled={isSubmittingReport}>
                  {isSubmittingReport ? "Submitting..." : "Report Incident"}
                </button>
              </form>
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
            ) : (
              <button type="button" disabled>
                Adopt Tree
              </button>
            )}
            {isAuthenticated && hasRole("MANAGER", "ADMIN") ? (
              <form className="inline-form" onSubmit={(event) => void scheduleMaintenance(event)}>
                <label>
                  Task type
                  <select value={maintenanceType} onChange={(event) => setMaintenanceType(event.target.value)}>
                    {maintenanceTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Priority
                  <select
                    value={maintenancePriority}
                    onChange={(event) => setMaintenancePriority(event.target.value)}
                  >
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Title
                  <input
                    value={maintenanceTitle}
                    onChange={(event) => setMaintenanceTitle(event.target.value)}
                    minLength={3}
                    maxLength={160}
                    required
                    placeholder={`Inspect ${asset.commonName ?? asset.species}`}
                  />
                </label>

                <label>
                  Description
                  <textarea
                    value={maintenanceDescription}
                    onChange={(event) => setMaintenanceDescription(event.target.value)}
                    maxLength={1000}
                    placeholder="Describe the planned work for the field team."
                  />
                </label>

                <label>
                  Scheduled for
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(event) => setScheduledFor(event.target.value)}
                  />
                </label>

                <label>
                  Due at
                  <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                </label>

                {maintenanceError ? <p className="form-error">{maintenanceError}</p> : null}
                {createdMaintenanceTask ? (
                  <p className="form-success">
                    Created {createdMaintenanceTask.status.toLowerCase()} task {createdMaintenanceTask.title}. View it in{" "}
                    <Link to="/worklist">Worklist</Link>.
                  </p>
                ) : null}

                <button type="submit" disabled={isSchedulingMaintenance}>
                  {isSchedulingMaintenance ? "Scheduling..." : "Schedule Maintenance"}
                </button>
              </form>
            ) : (
              <button type="button" disabled>
                Schedule Maintenance
              </button>
            )}
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
