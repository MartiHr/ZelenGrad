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

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Zone = {
  id: string;
  name: string;
};

type AssetFormState = {
  type: string;
  commonName: string;
  species: string;
  description: string;
  latitude: string;
  longitude: string;
  plantedAt: string;
  healthStatus: string;
  lifecycleStatus: string;
  zoneId: string;
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
const assetTypes = ["TREE", "PARK", "SHRUB", "GARDEN"];
const assetHealthStatuses = ["HEALTHY", "NEEDS_ATTENTION", "DRY", "DISEASED", "DAMAGED", "REMOVED"];
const assetLifecycleStatuses = ["ACTIVE", "UNDER_MAINTENANCE", "ARCHIVED"];

const formatDate = (value: string | null) => {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const formatDateInput = (value: string | null) => {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
};

const createAssetFormState = (asset: Asset): AssetFormState => ({
  type: asset.type,
  commonName: asset.commonName ?? "",
  species: asset.species,
  description: asset.description ?? "",
  latitude: asset.latitude,
  longitude: asset.longitude,
  plantedAt: formatDateInput(asset.plantedAt),
  healthStatus: asset.healthStatus,
  lifecycleStatus: asset.lifecycleStatus,
  zoneId: asset.zone?.id ?? ""
});

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
  const [assignedToId, setAssignedToId] = useState("");
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [createdMaintenanceTask, setCreatedMaintenanceTask] = useState<MaintenanceTask | null>(null);
  const [isSchedulingMaintenance, setIsSchedulingMaintenance] = useState(false);
  const [assetForm, setAssetForm] = useState<AssetFormState | null>(null);
  const [assetUpdateError, setAssetUpdateError] = useState<string | null>(null);
  const [assetUpdateSuccess, setAssetUpdateSuccess] = useState<string | null>(null);
  const [isUpdatingAsset, setIsUpdatingAsset] = useState(false);
  const [isArchivingAsset, setIsArchivingAsset] = useState(false);

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
        setAssetForm(createAssetFormState(assetResponse));
        setHistory(historyResponse);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load asset details.");
      })
      .finally(() => setIsLoading(false));
  }, [assetId]);

  useEffect(() => {
    if (!token || !hasRole("MANAGER", "ADMIN")) {
      setStaffUsers([]);
      return;
    }

    setStaffError(null);

    apiRequest<StaffUser[]>("/users/staff", { token })
      .then(setStaffUsers)
      .catch((caughtError) => {
        setStaffError(caughtError instanceof ApiError ? caughtError.message : "Could not load staff users.");
      });
  }, [hasRole, token]);

  useEffect(() => {
    if (!isAuthenticated) {
      setZones([]);
      return;
    }

    apiRequest<Zone[]>("/zones")
      .then(setZones)
      .catch(() => setZones([]));
  }, [isAuthenticated]);

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
      await refreshUser();
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
          zoneId: assetForm?.zoneId || asset.zone?.id,
          assignedToId: assignedToId || undefined
        }
      });

      setCreatedMaintenanceTask(task);
      setMaintenanceTitle("");
      setMaintenanceDescription("");
      setScheduledFor("");
      setDueAt("");
      setAssignedToId("");
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

  const updateAssetForm = (patch: Partial<AssetFormState>) => {
    setAssetForm((current) => (current ? { ...current, ...patch } : current));
  };

  const updateAssetRegistry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token || !assetForm) {
      setAssetUpdateError("Please log in before updating this asset.");
      return;
    }

    setIsUpdatingAsset(true);
    setAssetUpdateError(null);
    setAssetUpdateSuccess(null);

    try {
      const updatedAsset = await apiRequest<Asset>(`/assets/${asset.id}`, {
        method: "PUT",
        token,
        body: {
          type: assetForm.type,
          commonName: assetForm.commonName.trim() || undefined,
          species: assetForm.species,
          description: assetForm.description.trim() || undefined,
          latitude: assetForm.latitude,
          longitude: assetForm.longitude,
          plantedAt: assetForm.plantedAt || undefined,
          healthStatus: assetForm.healthStatus,
          lifecycleStatus: assetForm.lifecycleStatus,
          zoneId: assetForm.zoneId || null
        }
      });

      const updatedHistory = await apiRequest<AssetHistory>(`/assets/${asset.id}/history`);

      setAsset(updatedAsset);
      setAssetForm(createAssetFormState(updatedAsset));
      setHistory(updatedHistory);
      setAssetUpdateSuccess("Asset registry updated.");
    } catch (caughtError) {
      setAssetUpdateError(caughtError instanceof ApiError ? caughtError.message : "Could not update asset.");
    } finally {
      setIsUpdatingAsset(false);
    }
  };

  const archiveAsset = async () => {
    if (!token) {
      setAssetUpdateError("Please log in before archiving this asset.");
      return;
    }

    const shouldArchive = window.confirm("Archive this asset? It will no longer appear on the public green map.");

    if (!shouldArchive) {
      return;
    }

    setIsArchivingAsset(true);
    setAssetUpdateError(null);
    setAssetUpdateSuccess(null);

    try {
      const archivedAsset = await apiRequest<Asset>(`/assets/${asset.id}`, {
        method: "DELETE",
        token
      });

      setAsset(archivedAsset);
      setAssetForm(createAssetFormState(archivedAsset));
      setAssetUpdateSuccess("Asset archived.");
    } catch (caughtError) {
      setAssetUpdateError(caughtError instanceof ApiError ? caughtError.message : "Could not archive asset.");
    } finally {
      setIsArchivingAsset(false);
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

        {isAuthenticated && hasRole("EMPLOYEE", "MANAGER", "ADMIN") && assetForm ? (
          <article className="panel details-panel">
            <h2>Registry Editor</h2>
            <form className="inline-form asset-form" onSubmit={(event) => void updateAssetRegistry(event)}>
              <div className="form-grid">
                <label>
                  Type
                  <select value={assetForm.type} onChange={(event) => updateAssetForm({ type: event.target.value })}>
                    {assetTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Health
                  <select
                    value={assetForm.healthStatus}
                    onChange={(event) => updateAssetForm({ healthStatus: event.target.value })}
                  >
                    {assetHealthStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Lifecycle
                  <select
                    value={assetForm.lifecycleStatus}
                    onChange={(event) => updateAssetForm({ lifecycleStatus: event.target.value })}
                  >
                    {assetLifecycleStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Common name
                  <input
                    value={assetForm.commonName}
                    onChange={(event) => updateAssetForm({ commonName: event.target.value })}
                    maxLength={120}
                  />
                </label>
                <label>
                  Species
                  <input
                    value={assetForm.species}
                    onChange={(event) => updateAssetForm({ species: event.target.value })}
                    maxLength={160}
                    required
                  />
                </label>
                <label>
                  Latitude
                  <input
                    value={assetForm.latitude}
                    onChange={(event) => updateAssetForm({ latitude: event.target.value })}
                    required
                    step="0.000001"
                    type="number"
                  />
                </label>
                <label>
                  Longitude
                  <input
                    value={assetForm.longitude}
                    onChange={(event) => updateAssetForm({ longitude: event.target.value })}
                    required
                    step="0.000001"
                    type="number"
                  />
                </label>
                <label>
                  Planted
                  <input
                    type="date"
                    value={assetForm.plantedAt}
                    onChange={(event) => updateAssetForm({ plantedAt: event.target.value })}
                  />
                </label>
                <label>
                  Zone
                  <select
                    value={assetForm.zoneId}
                    onChange={(event) => updateAssetForm({ zoneId: event.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Description
                <textarea
                  value={assetForm.description}
                  onChange={(event) => updateAssetForm({ description: event.target.value })}
                  maxLength={1000}
                />
              </label>

              {assetUpdateError ? <p className="form-error">{assetUpdateError}</p> : null}
              {assetUpdateSuccess ? <p className="form-success">{assetUpdateSuccess}</p> : null}

              <div className="button-row">
                <button type="submit" disabled={isUpdatingAsset}>
                  {isUpdatingAsset ? "Saving..." : "Save Registry"}
                </button>
                <button className="danger-button" type="button" disabled={isArchivingAsset} onClick={() => void archiveAsset()}>
                  {isArchivingAsset ? "Archiving..." : "Archive Asset"}
                </button>
              </div>
            </form>
          </article>
        ) : null}

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
            ) : null}
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

                <label>
                  Assignee
                  <select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)}>
                    <option value="">Unassigned</option>
                    {staffUsers.map((staffUser) => (
                      <option key={staffUser.id} value={staffUser.id}>
                        {staffUser.name} ({staffUser.role})
                      </option>
                    ))}
                  </select>
                </label>

                {staffError ? <p className="form-error">{staffError}</p> : null}
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
