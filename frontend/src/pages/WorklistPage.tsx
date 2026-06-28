import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import { StaffSearchSelect } from "../components/StaffSearchSelect";
import { isBlank } from "../validation";

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
const statusHints: Record<string, string> = {
  PLANNED: "Waiting for assignment or responsible-zone pickup.",
  ASSIGNED: "Ready for field work.",
  IN_PROGRESS: "Work has started.",
  COMPLETED: "Completed and logged.",
  CANCELLED: "No further action planned."
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const getNextStatuses = (status: string) => {
  switch (status) {
    case "PLANNED":
      return ["ASSIGNED", "IN_PROGRESS", "CANCELLED"];
    case "ASSIGNED":
      return ["IN_PROGRESS", "COMPLETED", "CANCELLED"];
    case "IN_PROGRESS":
      return ["COMPLETED", "CANCELLED"];
    case "COMPLETED":
    case "CANCELLED":
      return [];
    default:
      return statuses.filter((nextStatus) => nextStatus !== status);
  }
};

export const WorklistPage = () => {
  const { hasRole, token } = useAuth();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState(() => searchParams.get("zoneId") ?? "");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [responsibleEmployeeFilter, setResponsibleEmployeeFilter] = useState("");
  const [responsibleZonesMode, setResponsibleZonesMode] = useState(false);
  const [showAssignedToMe, setShowAssignedToMe] = useState(true);
  const [showUnassignedInZones, setShowUnassignedInZones] = useState(true);
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notesByTask, setNotesByTask] = useState<Record<string, string>>({});
  const [healthByTask, setHealthByTask] = useState<Record<string, string>>({});
  const [statusErrorByTask, setStatusErrorByTask] = useState<Record<string, string>>({});
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

      if (!canManageWorkload && responsibleZonesMode) {
        params.set("responsibleZoneOnly", "true");
      }

      if (!canManageWorkload && !responsibleZonesMode) {
        params.set("showAssignedToMe", String(showAssignedToMe));
        params.set("showUnassignedInZones", String(showUnassignedInZones));
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
  }, [assignedToFilter, canManageWorkload, responsibleZonesMode, responsibleEmployeeFilter, showAssignedToMe, showUnassignedInZones, statusFilter, token, zoneFilter]);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (scopeRef.current && !scopeRef.current.contains(event.target as Node)) {
        setIsScopeOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getScopeLabel = () => {
    if (responsibleZonesMode) return "All in my zones";

    const parts: string[] = [];
    if (showAssignedToMe) parts.push("Assigned");
    if (showUnassignedInZones) parts.push("Unassigned");
    return parts.length === 0 ? "None" : parts.join(" + ");
  };

  const updateStatus = async (task: MaintenanceTask, status: string) => {
    if (!token) {
      return;
    }

    if (status === "COMPLETED" && isBlank(notesByTask[task.id] ?? "") && !healthByTask[task.id]) {
      setStatusErrorByTask((current) => ({
        ...current,
        [task.id]: "Add completion notes or resulting health before completing this task."
      }));
      return;
    }

    setUpdatingId(task.id);
    setError(null);
    setStatusErrorByTask((current) => ({ ...current, [task.id]: "" }));

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
      setNotesByTask((current) => ({ ...current, [task.id]: "" }));
      setHealthByTask((current) => ({ ...current, [task.id]: "" }));
      setStatusErrorByTask((current) => ({ ...current, [task.id]: "" }));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not update task.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="page">
      <h1>Worklist</h1>
      <p>
        Review assigned work, responsible-zone pool tasks, and field completion updates without losing the operational
        context.
      </p>

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
          <>
            <div className="scope-dropdown" ref={scopeRef}>
              <button type="button" className="scope-dropdown-trigger" onClick={() => setIsScopeOpen((c) => !c)}>
                Scope: {getScopeLabel()}
              </button>
              {isScopeOpen ? (
                <div className="scope-dropdown-panel">
                  <label className="scope-option">
                    <input
                      type="checkbox"
                      checked={showAssignedToMe}
                      disabled={responsibleZonesMode}
                      onChange={(event) => {
                        setShowAssignedToMe(event.target.checked);
                        if (event.target.checked) {
                          setResponsibleZonesMode(false);
                        }
                      }}
                    />
                    Assigned to me
                  </label>
                  <label className="scope-option">
                    <input
                      type="checkbox"
                      checked={showUnassignedInZones}
                      disabled={responsibleZonesMode}
                      onChange={(event) => {
                        setShowUnassignedInZones(event.target.checked);
                        if (event.target.checked) {
                          setResponsibleZonesMode(false);
                        }
                      }}
                    />
                    Unassigned in my zones
                  </label>
                  <label className="scope-option">
                    <input
                      type="checkbox"
                      checked={responsibleZonesMode}
                      onChange={(event) => {
                        setResponsibleZonesMode(event.target.checked);
                        if (event.target.checked) {
                          setShowAssignedToMe(false);
                          setShowUnassignedInZones(false);
                        }
                      }}
                    />
                    All work in my responsible zones
                  </label>
                </div>
              ) : null}
            </div>
          </>
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

      <div className="worklist-summary">
        <span>{tasks.length} visible tasks</span>
        <span>{tasks.filter((task) => !task.assignedTo).length} unassigned</span>
        <span>{tasks.filter((task) => task.status === "IN_PROGRESS").length} in progress</span>
        <span>{tasks.filter((task) => task.status === "COMPLETED").length} completed</span>
      </div>

      <div className="task-list">
        {isLoading ? <p>Loading tasks...</p> : null}
        {!isLoading && tasks.length === 0 ? <p>No maintenance tasks match the current filters.</p> : null}
        {tasks.map((task) => {
          const nextStatuses = getNextStatuses(task.status);
          const isUpdating = updatingId === task.id;
          const taskStatusError = statusErrorByTask[task.id];

          return (
          <article className={`task-card status-${task.status.toLowerCase()}`} key={task.id}>
            <header>
              <div>
                <p className="eyebrow">{task.type}</p>
                <h2>{task.title}</h2>
                <p className="muted-text">{statusHints[task.status] ?? "Maintenance task"}</p>
              </div>
              <div className="task-chip-row">
                <span className={`badge status-badge ${task.status.toLowerCase()}`}>{task.status}</span>
                <span className={`badge ${task.priority.toLowerCase()}`}>{task.priority}</span>
              </div>
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
                <dd>
                  {task.assignedTo?.name ?? "Unassigned"}
                  {!task.assignedTo ? <span className="inline-note">zone pool</span> : null}
                </dd>
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

            {nextStatuses.includes("COMPLETED") ? (
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
            ) : null}
            {taskStatusError ? <p className="form-error">{taskStatusError}</p> : null}

            <div className="button-row">
              <Link to={`/worklist/${task.id}`}>Open details</Link>
              {nextStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={updatingId === task.id || task.status === status}
                  onClick={() => void updateStatus(task, status)}
                >
                  {isUpdating ? "Updating..." : status}
                </button>
              ))}
              {nextStatuses.length === 0 ? <span className="muted-text">No status actions available.</span> : null}
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
};
