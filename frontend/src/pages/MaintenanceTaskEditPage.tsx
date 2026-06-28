import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import { StaffSearchSelect } from "../components/StaffSearchSelect";
import { validateDateOrder, validateRequiredText, type FieldErrors } from "../validation";

type UserSummary = {
  id: string;
  name: string;
  email: string;
};

type MaintenanceTask = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  scheduledFor: string | null;
  dueAt: string | null;
  recurrenceRule: string | null;
  asset: { id: string; commonName: string | null; species: string; healthStatus: string } | null;
  zone: { id: string; name: string } | null;
  assignedTo: UserSummary | null;
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

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const maintenanceTypes = ["WATERING", "PRUNING", "INSPECTION", "TREATMENT", "CLEANUP", "REMOVAL", "OTHER"];

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

export const MaintenanceTaskEditPage = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [task, setTask] = useState<MaintenanceTask | null>(null);
  const [editForm, setEditForm] = useState<TaskEditForm | null>(null);
  const [assets, setAssets] = useState<GreenAsset[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<TaskEditField>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId || !token) {
      setError("Task id is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    Promise.all([
      apiRequest<MaintenanceTask>(`/maintenance/${taskId}`, { token }),
      apiRequest<GreenAsset[]>("/assets"),
      apiRequest<Zone[]>("/zones"),
      apiRequest<StaffUser[]>("/users/staff", { token })
    ])
      .then(([taskResponse, assetsResponse, zonesResponse, staffResponse]) => {
        setTask(taskResponse);
        setEditForm(createTaskEditForm(taskResponse));
        setAssets(assetsResponse);
        setZones(zonesResponse);
        setStaffUsers(staffResponse);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load task editor.");
      })
      .finally(() => setIsLoading(false));
  }, [taskId, token]);

  const updateEditForm = (patch: Partial<TaskEditForm>) => {
    setEditForm((current) => (current ? { ...current, ...patch } : current));
  };

  const saveTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!task || !token || !editForm) {
      return;
    }

    setError(null);
    setFieldErrors({});
    setReferenceError(null);

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
      setFieldErrors(nextFieldErrors);
      setError("Fix the highlighted task fields before saving.");
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

      navigate(`/worklist/${updatedTask.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not update maintenance task.");
    } finally {
      setIsSavingTask(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page narrow-edit">
        <h1>Edit Task</h1>
        <p>Loading task editor...</p>
      </section>
    );
  }

  if (!task || !editForm) {
    return (
      <section className="page narrow">
        <h1>Edit Task</h1>
        <p className="form-error">{error ?? "Maintenance task not found."}</p>
        <Link className="text-link" to="/worklist">
          Back to worklist
        </Link>
      </section>
    );
  }

  return (
    <section className="page narrow-edit">
      <div className="details-header">
        <div>
          <p className="eyebrow">Task editor</p>
          <h1>{task.title}</h1>
          <p>Adjust assignment, schedule, target, and recurrence details from one focused view.</p>
        </div>
        <Link to={`/worklist/${task.id}`}>Back to task</Link>
      </div>

      <article className="panel details-panel">
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
              <select value={editForm.priority} onChange={(event) => updateEditForm({ priority: event.target.value })}>
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
                aria-invalid={Boolean(fieldErrors.title)}
                value={editForm.title}
                onChange={(event) => updateEditForm({ title: event.target.value })}
                minLength={3}
                maxLength={160}
                required
              />
              {fieldErrors.title ? <span className="field-error">{fieldErrors.title}</span> : null}
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
                aria-invalid={Boolean(fieldErrors.dueAt)}
                type="datetime-local"
                value={editForm.dueAt}
                onChange={(event) => updateEditForm({ dueAt: event.target.value })}
              />
              {fieldErrors.dueAt ? <span className="field-error">{fieldErrors.dueAt}</span> : null}
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
          {error ? <p className="form-error">{error}</p> : null}

          <div className="button-row">
            <button type="submit" disabled={isSavingTask}>
              {isSavingTask ? "Saving..." : "Save Task"}
            </button>
            <button className="muted-button" type="button" onClick={() => navigate(`/worklist/${task.id}`)}>
              Cancel
            </button>
          </div>
        </form>
      </article>
    </section>
  );
};
