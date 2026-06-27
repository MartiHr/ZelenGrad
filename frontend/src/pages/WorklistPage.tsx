import { useEffect, useState } from "react";
import { Link } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import { StaffSearchSelect } from "../components/StaffSearchSelect";

type MaintenanceTask = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  scheduledFor: string | null;
  dueAt: string | null;
  asset: { id: string; commonName: string | null; species: string; healthStatus: string } | null;
  zone: { id: string; name: string } | null;
  assignedTo: { id: string; name: string; email: string } | null;
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

const statuses = ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const filterStatuses = ["PLANNED", ...statuses];
const healthStatuses = ["HEALTHY", "NEEDS_ATTENTION", "DRY", "DISEASED", "DAMAGED", "REMOVED"];

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

export const WorklistPage = () => {
  const { hasRole, token } = useAuth();
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [responsibleEmployeeFilter, setResponsibleEmployeeFilter] = useState("");
  const [employeeScope, setEmployeeScope] = useState("assigned");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notesByTask, setNotesByTask] = useState<Record<string, string>>({});
  const [healthByTask, setHealthByTask] = useState<Record<string, string>>({});
  const canManageWorkload = hasRole("MANAGER", "ADMIN");

  const loadTasks = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      if (zoneFilter) {
        params.set("zoneId", zoneFilter);
      }

      if (canManageWorkload && assignedToFilter) {
        params.set("assignedToId", assignedToFilter);
      }

      if (canManageWorkload && responsibleEmployeeFilter) {
        params.set("responsibleEmployeeId", responsibleEmployeeFilter);
      }

      if (!canManageWorkload && employeeScope === "responsible-zones") {
        params.set("responsibleZoneOnly", "true");
      }

      const query = params.toString();
      setTasks(await apiRequest<MaintenanceTask[]>(`/maintenance${query ? `?${query}` : ""}`, { token }));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not load maintenance tasks.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, [assignedToFilter, canManageWorkload, employeeScope, responsibleEmployeeFilter, statusFilter, token, zoneFilter]);

  useEffect(() => {
    apiRequest<Zone[]>("/zones")
      .then(setZones)
      .catch(() => setZones([]));
  }, []);

  useEffect(() => {
    if (!token || !canManageWorkload) {
      setStaffUsers([]);
      return;
    }

    apiRequest<StaffUser[]>("/users/staff", { token })
      .then(setStaffUsers)
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load staff users.");
      });
  }, [canManageWorkload, token]);

  const updateStatus = async (task: MaintenanceTask, status: string) => {
    if (!token) {
      return;
    }

    setUpdatingId(task.id);
    setError(null);

    try {
      const updatedTask = await apiRequest<MaintenanceTask>(`/maintenance/${task.id}/status`, {
        method: "PATCH",
        token,
        body: {
          status,
          notes: notesByTask[task.id] || undefined,
          resultingHealth: status === "COMPLETED" ? healthByTask[task.id] || undefined : undefined
        }
      });

      setTasks((current) => current.map((currentTask) => (currentTask.id === task.id ? updatedTask : currentTask)));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not update task.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="page">
      <h1>Worklist</h1>
      <p>Review assigned maintenance tasks, start field work, and log completion details.</p>

      <div className="toolbar">
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All</option>
            {filterStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zone
          <select value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}>
            <option value="">All zones</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
        {canManageWorkload ? (
          <>
            <label>
              Assigned to
              <StaffSearchSelect
                value={assignedToFilter}
                onChange={setAssignedToFilter}
                staffUsers={staffUsers}
                placeholder="Any assignee"
              />
            </label>
            <label>
              Responsible zone
              <StaffSearchSelect
                value={responsibleEmployeeFilter}
                onChange={setResponsibleEmployeeFilter}
                staffUsers={staffUsers}
                placeholder="Any responsible staff"
              />
            </label>
          </>
        ) : (
          <label>
            Scope
            <select value={employeeScope} onChange={(event) => setEmployeeScope(event.target.value)}>
              <option value="assigned">Assigned to me</option>
              <option value="responsible-zones">My responsible zones</option>
            </select>
          </label>
        )}
      </div>

      {canManageWorkload && tasks.length ? (
        <div className="dashboard-grid">
          <article className="panel details-panel">
            <h2>By Zone</h2>
            <dl className="count-list">
              {Object.entries(
                tasks.reduce<Record<string, number>>((counts, task) => {
                  const key = task.zone?.name ?? "Unassigned";
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
            <h2>By Assignee</h2>
            <dl className="count-list">
              {Object.entries(
                tasks.reduce<Record<string, number>>((counts, task) => {
                  const key = task.assignedTo?.name ?? "Unassigned";
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
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="task-list">
        {isLoading ? <p>Loading tasks...</p> : null}
        {!isLoading && tasks.length === 0 ? <p>No maintenance tasks are assigned right now.</p> : null}
        {tasks.map((task) => (
          <article className="task-card" key={task.id}>
            <header>
              <div>
                <p className="eyebrow">{task.type}</p>
                <h2>{task.title}</h2>
              </div>
              <span className={`badge ${task.priority.toLowerCase()}`}>{task.priority}</span>
            </header>
            {task.description ? <p>{task.description}</p> : null}
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{task.status}</dd>
              </div>
              <div>
                <dt>Asset</dt>
                <dd>{task.asset?.commonName ?? task.asset?.species ?? "Zone task"}</dd>
              </div>
              <div>
                <dt>Zone</dt>
                <dd>{task.zone?.name ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt>Assignee</dt>
                <dd>{task.assignedTo?.name ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt>Scheduled</dt>
                <dd>{formatDateTime(task.scheduledFor)}</dd>
              </div>
              <div>
                <dt>Due</dt>
                <dd>{formatDateTime(task.dueAt)}</dd>
              </div>
            </dl>

            <div className="completion-fields">
              <label>
                Completion notes
                <textarea
                  value={notesByTask[task.id] ?? ""}
                  onChange={(event) => setNotesByTask((current) => ({ ...current, [task.id]: event.target.value }))}
                  placeholder="Watered with 20 liters, checked soil..."
                />
              </label>
              <label>
                Resulting health
                <select
                  value={healthByTask[task.id] ?? ""}
                  onChange={(event) => setHealthByTask((current) => ({ ...current, [task.id]: event.target.value }))}
                >
                  <option value="">No change</option>
                  {healthStatuses.map((healthStatus) => (
                    <option key={healthStatus} value={healthStatus}>
                      {healthStatus}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="button-row">
              <Link to={`/worklist/${task.id}`}>Open details</Link>
              {statuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={updatingId === task.id || task.status === status}
                  onClick={() => void updateStatus(task, status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
