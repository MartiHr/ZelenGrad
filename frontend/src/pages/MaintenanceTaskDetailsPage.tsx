import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import { StaffSearchSelect } from "../components/StaffSearchSelect";
import { isBlank, validateDateOrder, validateRequiredText, type FieldErrors } from "../validation";

type UserSummary = {
  id: string;
  name: string;
  email: string;
};

type MaintenanceLog = {
  id: string;
  notes: string | null;
  resultingHealth: string | null;
  performedAt: string;
  createdAt: string;
  employee: UserSummary | null;
};

type MaintenanceTask = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  scheduledFor: string | null;
  dueAt: string | null;
  recurrenceRule: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  asset: { id: string; commonName: string | null; species: string; healthStatus: string } | null;
  zone: { id: string; name: string } | null;
  assignedTo: UserSummary | null;
  createdBy: UserSummary | null;
  completedBy: UserSummary | null;
  logs: MaintenanceLog[];
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

type StaffUser = UserSummary & {
  role: string;
};

type TaskEditForm = {
  title: string;
  description: string;
  type: string;
  priority: string;
  scheduledFor: string;
  dueAt: string;
  recurrenceRule: string;
  assetId: string;
  zoneId: string;
  assignedToId: string;
};

type TaskEditField = "title" | "dueAt";

const statuses = ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const healthStatuses = ["HEALTHY", "NEEDS_ATTENTION", "DRY", "DISEASED", "DAMAGED", "REMOVED"];
const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const maintenanceTypes = ["WATERING", "PRUNING", "INSPECTION", "TREATMENT", "CLEANUP", "REMOVAL", "OTHER"];

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const formatUser = (user: UserSummary | null) => (user ? `${user.name} (${user.email})` : "Unassigned");

const formatDateTimeInput = (value: string | null) => {
  if (!value) {
    return "";
  }

  return value.slice(0, 16);
};

const createTaskEditForm = (task: MaintenanceTask): TaskEditForm => ({
  title: task.title,
  description: task.description ?? "",
  type: task.type,
  priority: task.priority,
  scheduledFor: formatDateTimeInput(task.scheduledFor),
  dueAt: formatDateTimeInput(task.dueAt),
  recurrenceRule: task.recurrenceRule ?? "",
  assetId: task.asset?.id ?? "",
  zoneId: task.zone?.id ?? "",
  assignedToId: task.assignedTo?.id ?? ""
});

export const MaintenanceTaskDetailsPage = () => {
  const { taskId } = useParams();
  const { hasRole, token } = useAuth();
  const [task, setTask] = useState<MaintenanceTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [resultingHealth, setResultingHealth] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TaskEditForm | null>(null);
  const [assets, setAssets] = useState<GreenAsset[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors<TaskEditField>>({});
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const canManageTasks = hasRole("MANAGER", "ADMIN");

  useEffect(() => {
    if (!taskId || !token) {
      setError("Task id is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    apiRequest<MaintenanceTask>(`/maintenance/${taskId}`, { token })
      .then((taskResponse) => {
        setTask(taskResponse);
        setEditForm(createTaskEditForm(taskResponse));
      })
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load maintenance task.");
      })
      .finally(() => setIsLoading(false));
  }, [taskId, token]);

  useEffect(() => {
    if (!token || !canManageTasks) {
      setAssets([]);
      setZones([]);
      setStaffUsers([]);
      return;
    }

    setReferenceError(null);

    Promise.all([
      apiRequest<GreenAsset[]>("/assets"),
      apiRequest<Zone[]>("/zones"),
      apiRequest<StaffUser[]>("/users/staff", { token })
    ])
      .then(([assetsResponse, zonesResponse, staffResponse]) => {
        setAssets(assetsResponse);
        setZones(zonesResponse);
        setStaffUsers(staffResponse);
      })
      .catch((caughtError) => {
        setReferenceError(caughtError instanceof ApiError ? caughtError.message : "Could not load editor options.");
      });
  }, [canManageTasks, token]);

  const updateTaskStatus = async (status: string) => {
    if (!task || !token) {
      return;
    }

    if (status === "COMPLETED" && isBlank(notes) && !resultingHealth) {
      setStatusError("Add completion notes or a resulting health value before completing this task.");
      return;
    }

    setUpdatingStatus(status);
    setError(null);
    setStatusError(null);

    try {
      const updatedTask = await apiRequest<MaintenanceTask>(`/maintenance/${task.id}/status`, {
        method: "PATCH",
        token,
        body: {
          status,
          notes: notes || undefined,
          resultingHealth: status === "COMPLETED" ? resultingHealth || undefined : undefined
        }
      });

      setTask(updatedTask);
      setNotes("");
      setResultingHealth("");
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not update task.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateEditForm = (patch: Partial<TaskEditForm>) => {
    setEditForm((current) => (current ? { ...current, ...patch } : current));
  };

  const saveTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!task || !token || !editForm) {
      return;
    }

    setEditError(null);
    setEditFieldErrors({});
    setEditSuccess(null);

    const nextFieldErrors: FieldErrors<TaskEditField> = {};
    const titleError = validateRequiredText(editForm.title, "Title", 3);
    const dateOrderError = validateDateOrder(editForm.scheduledFor, editForm.dueAt, "scheduled date", "Due date");

    if (titleError) {
      nextFieldErrors.title = titleError;
    }

    if (dateOrderError) {
      nextFieldErrors.dueAt = dateOrderError;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setEditFieldErrors(nextFieldErrors);
      setEditError("Fix the highlighted task fields before saving.");
      return;
    }

    setIsSavingTask(true);

    try {
      const updatedTask = await apiRequest<MaintenanceTask>(`/maintenance/${task.id}`, {
        method: "PUT",
        token,
        body: {
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          type: editForm.type,
          priority: editForm.priority,
          scheduledFor: editForm.scheduledFor || null,
          dueAt: editForm.dueAt || null,
          recurrenceRule: editForm.recurrenceRule.trim() || null,
          assetId: editForm.assetId || null,
          zoneId: editForm.zoneId || null,
          assignedToId: editForm.assignedToId || null
        }
      });

      setTask(updatedTask);
      setEditForm(createTaskEditForm(updatedTask));
      setEditSuccess("Task updated.");
    } catch (caughtError) {
      setEditError(caughtError instanceof ApiError ? caughtError.message : "Could not update maintenance task.");
    } finally {
      setIsSavingTask(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page">
        <h1>Task Details</h1>
        <p>Loading maintenance task...</p>
      </section>
    );
  }

  if (error || !task) {
    return (
      <section className="page narrow">
        <h1>Task Details</h1>
        <p className="form-error">{error ?? "Maintenance task not found."}</p>
        <Link className="text-link" to="/worklist">
          Back to worklist
        </Link>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="details-header">
        <div>
          <p className="eyebrow">{task.type}</p>
          <h1>{task.title}</h1>
          <p>{task.description ?? "No additional task description was provided."}</p>
        </div>
        <Link to="/worklist">Back to worklist</Link>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {canManageTasks && editForm ? (
        <article className="panel details-panel">
          <h2>Task Editor</h2>
          <form className="inline-form asset-form" onSubmit={(event) => void saveTask(event)} noValidate>
            <div className="form-grid">
              <label>
                Type
                <select value={editForm.type} onChange={(event) => updateEditForm({ type: event.target.value })}>
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
                  value={editForm.priority}
                  onChange={(event) => updateEditForm({ priority: event.target.value })}
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
                  aria-invalid={Boolean(editFieldErrors.title)}
                  value={editForm.title}
                  onChange={(event) => updateEditForm({ title: event.target.value })}
                  minLength={3}
                  maxLength={160}
                  required
                />
                {editFieldErrors.title ? <span className="field-error">{editFieldErrors.title}</span> : null}
              </label>
              <label>
                Assignee
                <StaffSearchSelect
                  value={editForm.assignedToId}
                  onChange={(assignedToId) => updateEditForm({ assignedToId })}
                  staffUsers={staffUsers}
                  placeholder="Unassigned"
                />
              </label>
              <label>
                Asset target
                <select value={editForm.assetId} onChange={(event) => updateEditForm({ assetId: event.target.value })}>
                  <option value="">No asset target</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.commonName ?? asset.species}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Zone target
                <select value={editForm.zoneId} onChange={(event) => updateEditForm({ zoneId: event.target.value })}>
                  <option value="">No zone target</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Scheduled for
                <input
                  type="datetime-local"
                  value={editForm.scheduledFor}
                  onChange={(event) => updateEditForm({ scheduledFor: event.target.value })}
                />
              </label>
              <label>
                Due at
                <input
                  aria-invalid={Boolean(editFieldErrors.dueAt)}
                  type="datetime-local"
                  value={editForm.dueAt}
                  onChange={(event) => updateEditForm({ dueAt: event.target.value })}
                />
                {editFieldErrors.dueAt ? <span className="field-error">{editFieldErrors.dueAt}</span> : null}
              </label>
              <label>
                Recurrence
                <input
                  value={editForm.recurrenceRule}
                  onChange={(event) => updateEditForm({ recurrenceRule: event.target.value })}
                  maxLength={160}
                  placeholder="FREQ=WEEKLY;INTERVAL=1"
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                value={editForm.description}
                onChange={(event) => updateEditForm({ description: event.target.value })}
                maxLength={1000}
              />
            </label>

            {referenceError ? <p className="form-error">{referenceError}</p> : null}
            {editError ? <p className="form-error">{editError}</p> : null}
            {editSuccess ? <p className="form-success">{editSuccess}</p> : null}

            <button type="submit" disabled={isSavingTask}>
              {isSavingTask ? "Saving..." : "Save Task"}
            </button>
          </form>
        </article>
      ) : null}

      <div className="details-grid">
        <article className="panel details-panel">
          <h2>Assignment</h2>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{task.status}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{task.priority}</dd>
            </div>
            <div>
              <dt>Assignee</dt>
              <dd>{formatUser(task.assignedTo)}</dd>
            </div>
            <div>
              <dt>Created by</dt>
              <dd>{formatUser(task.createdBy)}</dd>
            </div>
            <div>
              <dt>Completed by</dt>
              <dd>{formatUser(task.completedBy)}</dd>
            </div>
            <div>
              <dt>Recurrence</dt>
              <dd>{task.recurrenceRule ?? "One-time task"}</dd>
            </div>
          </dl>

          <div className="completion-fields">
            <label>
              Completion notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Watered with 20 liters, pruned branches, replaced mulch..."
              />
            </label>
            <label>
              Resulting health
              <select value={resultingHealth} onChange={(event) => setResultingHealth(event.target.value)}>
                <option value="">No change</option>
                {healthStatuses.map((healthStatus) => (
                  <option key={healthStatus} value={healthStatus}>
                    {healthStatus}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {statusError ? <p className="form-error">{statusError}</p> : null}

          <div className="button-row">
            {statuses.map((status) => (
              <button
                key={status}
                type="button"
                disabled={updatingStatus !== null || task.status === status}
                onClick={() => void updateTaskStatus(status)}
              >
                {updatingStatus === status ? "Updating..." : status}
              </button>
            ))}
          </div>
        </article>

        <article className="panel details-panel">
          <h2>Schedule</h2>
          <dl>
            <div>
              <dt>Scheduled</dt>
              <dd>{formatDateTime(task.scheduledFor)}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{formatDateTime(task.dueAt)}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{formatDateTime(task.completedAt)}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(task.createdAt)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDateTime(task.updatedAt)}</dd>
            </div>
          </dl>
        </article>
      </div>

      <div className="details-grid">
        <article className="panel details-panel">
          <h2>Target</h2>
          <dl>
            <div>
              <dt>Asset</dt>
              <dd>
                {task.asset ? (
                  <Link className="text-link" to={`/assets/${task.asset.id}`}>
                    {task.asset.commonName ?? task.asset.species}
                  </Link>
                ) : (
                  "Zone task"
                )}
              </dd>
            </div>
            <div>
              <dt>Species</dt>
              <dd>{task.asset?.species ?? "Not applicable"}</dd>
            </div>
            <div>
              <dt>Asset health</dt>
              <dd>{task.asset?.healthStatus ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Zone</dt>
              <dd>{task.zone?.name ?? "Unassigned"}</dd>
            </div>
          </dl>
        </article>

        <article className="panel details-panel">
          <h2>Completion History</h2>
          {task.logs.length ? (
            <ul className="timeline">
              {task.logs.map((log) => (
                <li key={log.id}>
                  <strong>{log.resultingHealth ?? "Logged work"}</strong>
                  <span>{formatDateTime(log.performedAt)}</span>
                  <small>{log.employee ? formatUser(log.employee) : "Unknown employee"}</small>
                  {log.notes ? <p>{log.notes}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>No completion logs have been recorded yet.</p>
          )}
        </article>
      </div>
    </section>
  );
};
