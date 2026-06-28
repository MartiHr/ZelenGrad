import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";

type UserSummary = {
  id: string;
  name: string;
  email: string;
};

type AssetSummary = {
  id: string;
  commonName: string | null;
  species: string;
};

type AuditOverview = {
  generatedAt: string;
  rewardTransactions: Array<{
    id: string;
    points: number;
    reason: string;
    description: string | null;
    createdAt: string;
    user: UserSummary & {
      role: string;
      greenPoints: number;
    };
  }>;
  users: Array<UserSummary & {
    role: string;
    greenPoints: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    updatedAt: string;
    verifiedAt: string | null;
    resolvedAt: string | null;
    reporter: UserSummary | null;
    verifiedBy: UserSummary | null;
    asset: AssetSummary | null;
    zone: { id: string; name: string } | null;
  }>;
  maintenanceTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    updatedAt: string;
    completedAt: string | null;
    assignedTo: UserSummary | null;
    completedBy: UserSummary | null;
    asset: AssetSummary | null;
    zone: { id: string; name: string } | null;
  }>;
  maintenanceLogs: Array<{
    id: string;
    notes: string | null;
    resultingHealth: string | null;
    performedAt: string;
    employee: UserSummary | null;
    task: { id: string; title: string; status: string };
    asset: AssetSummary | null;
  }>;
  assetHealthLogs: Array<{
    id: string;
    status: string;
    source: string;
    notes: string | null;
    recordedAt: string;
    asset: AssetSummary;
  }>;
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const formatAsset = (asset: AssetSummary | null) => asset?.commonName ?? asset?.species ?? "Unlinked";

type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityLabel: string;
  happenedAt: string;
  detail: string;
  href?: string;
};

const getDateInputValue = (value: string) => value.slice(0, 10);

const buildAuditEntries = (overview: AuditOverview): AuditEntry[] => [
  ...overview.rewardTransactions.map((reward) => ({
    id: `reward:${reward.id}`,
    actor: reward.user.name,
    action: reward.points >= 0 ? "Awarded points" : "Deducted points",
    entityType: "Reward",
    entityLabel: `${reward.points > 0 ? "+" : ""}${reward.points} points`,
    happenedAt: reward.createdAt,
    detail: reward.description ?? `${reward.reason} for ${reward.user.email}`
  })),
  ...overview.users.map((user) => ({
    id: `user:${user.id}`,
    actor: user.name,
    action: user.isActive ? "Updated active user" : "Updated inactive user",
    entityType: "User",
    entityLabel: user.email,
    happenedAt: user.updatedAt,
    detail: `${user.role} account with ${user.greenPoints} points`
  })),
  ...overview.incidents.map((incident) => ({
    id: `incident:${incident.id}`,
    actor: incident.verifiedBy?.name ?? incident.reporter?.name ?? "System",
    action: `Incident ${incident.status.toLowerCase()}`,
    entityType: "Incident",
    entityLabel: incident.title,
    happenedAt: incident.updatedAt,
    detail: `${incident.priority} priority | ${formatAsset(incident.asset)} | ${incident.zone?.name ?? "Unassigned zone"}`,
    href: `/incidents/${incident.id}`
  })),
  ...overview.maintenanceTasks.map((task) => ({
    id: `task:${task.id}`,
    actor: task.completedBy?.name ?? task.assignedTo?.name ?? "System",
    action: `Task ${task.status.toLowerCase()}`,
    entityType: "Maintenance Task",
    entityLabel: task.title,
    happenedAt: task.updatedAt,
    detail: `${task.priority} priority | ${formatAsset(task.asset)} | ${task.zone?.name ?? "No zone"}`,
    href: `/worklist/${task.id}`
  })),
  ...overview.maintenanceLogs.map((log) => ({
    id: `maintenance-log:${log.id}`,
    actor: log.employee?.name ?? "Unknown employee",
    action: "Logged maintenance",
    entityType: "Maintenance Log",
    entityLabel: log.task.title,
    happenedAt: log.performedAt,
    detail: `${log.resultingHealth ?? log.task.status} | ${formatAsset(log.asset)} | ${log.notes ?? "No notes"}`,
    href: `/worklist/${log.task.id}`
  })),
  ...overview.assetHealthLogs.map((log) => ({
    id: `health-log:${log.id}`,
    actor: log.source,
    action: "Recorded asset health",
    entityType: "Asset Health Log",
    entityLabel: formatAsset(log.asset),
    happenedAt: log.recordedAt,
    detail: `${log.status} | ${log.notes ?? "No notes"}`,
    href: `/assets/${log.asset.id}`
  }))
].sort((left, right) => new Date(right.happenedAt).getTime() - new Date(left.happenedAt).getTime());

export const AuditPage = () => {
  const { token } = useAuth();
  const [overview, setOverview] = useState<AuditOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actorFilter, setActorFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadAuditOverview = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setOverview(await apiRequest<AuditOverview>("/audit/overview", { token }));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not load audit history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAuditOverview();
  }, [token]);

  const auditEntries = useMemo(() => (overview ? buildAuditEntries(overview) : []), [overview]);
  const actorOptions = useMemo(
    () => [...new Set(auditEntries.map((entry) => entry.actor))].sort((left, right) => left.localeCompare(right)),
    [auditEntries]
  );
  const actionOptions = useMemo(
    () => [...new Set(auditEntries.map((entry) => entry.action))].sort((left, right) => left.localeCompare(right)),
    [auditEntries]
  );
  const entityTypeOptions = useMemo(
    () => [...new Set(auditEntries.map((entry) => entry.entityType))].sort((left, right) => left.localeCompare(right)),
    [auditEntries]
  );
  const filteredAuditEntries = useMemo(
    () =>
      auditEntries.filter((entry) => {
        const entryDate = getDateInputValue(entry.happenedAt);

        return (
          (!actorFilter || entry.actor === actorFilter) &&
          (!actionFilter || entry.action === actionFilter) &&
          (!entityTypeFilter || entry.entityType === entityTypeFilter) &&
          (!dateFrom || entryDate >= dateFrom) &&
          (!dateTo || entryDate <= dateTo)
        );
      }),
    [actionFilter, actorFilter, auditEntries, dateFrom, dateTo, entityTypeFilter]
  );

  const clearFilters = () => {
    setActorFilter("");
    setActionFilter("");
    setEntityTypeFilter("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <section className="page">
      <div className="details-header">
        <div>
          <h1>Audit History</h1>
          <p>Recent administrative and operational changes across users, rewards, incidents, maintenance, and assets.</p>
        </div>
        <button type="button" className="refresh-button" onClick={() => void loadAuditOverview()}>
          Refresh
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {isLoading ? <p>Loading audit history...</p> : null}

      {overview ? (
        <>
          <article className="panel details-panel">
            <div className="panel-title-row">
              <div>
                <h2>Audit Log</h2>
                <p className="muted-text">
                  Showing {filteredAuditEntries.length} of {auditEntries.length} recent accountable events.
                </p>
              </div>
              <button type="button" className="secondary-action" onClick={clearFilters}>
                Clear Filters
              </button>
            </div>

            <div className="toolbar">
              <label>
                Actor
                <select value={actorFilter} onChange={(event) => setActorFilter(event.target.value)}>
                  <option value="">All actors</option>
                  {actorOptions.map((actor) => (
                    <option key={actor} value={actor}>
                      {actor}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Action
                <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
                  <option value="">All actions</option>
                  {actionOptions.map((action) => (
                    <option key={action} value={action}>
                      {action}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Entity
                <select value={entityTypeFilter} onChange={(event) => setEntityTypeFilter(event.target.value)}>
                  <option value="">All entities</option>
                  {entityTypeOptions.map((entityType) => (
                    <option key={entityType} value={entityType}>
                      {entityType}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                From
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </label>
              <label>
                To
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </label>
            </div>

            {filteredAuditEntries.length ? (
              <ul className="audit-log-list">
                {filteredAuditEntries.map((entry) => (
                  <li key={entry.id}>
                    <div>
                      <strong>{entry.action}</strong>
                      <span>
                        {entry.actor} | {formatDateTime(entry.happenedAt)}
                      </span>
                    </div>
                    <div>
                      {entry.href ? (
                        <Link className="text-link" to={entry.href}>
                          {entry.entityLabel}
                        </Link>
                      ) : (
                        <strong>{entry.entityLabel}</strong>
                      )}
                      <span>{entry.entityType}</span>
                    </div>
                    <p>{entry.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No audit events match the current filters.</p>
            )}
          </article>

          <section className="history-grid">
            <article className="panel details-panel">
              <h2>Reward Adjustments</h2>
              {overview.rewardTransactions.length ? (
                <ul className="timeline">
                  {overview.rewardTransactions.map((reward) => (
                    <li key={reward.id}>
                      <strong>
                        {reward.points > 0 ? "+" : ""}
                        {reward.points} points for {reward.user.name}
                      </strong>
                      <span>
                        {reward.reason} | {formatDateTime(reward.createdAt)}
                      </span>
                      <p>{reward.description ?? `${reward.user.email} now has ${reward.user.greenPoints} points.`}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No reward transactions have been recorded yet.</p>
              )}
            </article>

            <article className="panel details-panel">
              <h2>User Changes</h2>
              {overview.users.length ? (
                <ul className="timeline">
                  {overview.users.map((user) => (
                    <li key={user.id}>
                      <strong>{user.name}</strong>
                      <span>
                        {user.role} | {user.isActive ? "Active" : "Inactive"} | updated {formatDateTime(user.updatedAt)}
                      </span>
                      <p>
                        {user.email} | {user.greenPoints} points
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No users have been recorded yet.</p>
              )}
            </article>

            <article className="panel details-panel">
              <h2>Incident Reviews</h2>
              {overview.incidents.length ? (
                <ul className="timeline">
                  {overview.incidents.map((incident) => (
                    <li key={incident.id}>
                      <Link className="text-link" to={`/incidents/${incident.id}`}>
                        {incident.title}
                      </Link>
                      <span>
                        {incident.status} | {incident.priority} | updated {formatDateTime(incident.updatedAt)}
                      </span>
                      <p>
                        {formatAsset(incident.asset)} | {incident.zone?.name ?? "Unassigned"} | reviewed by{" "}
                        {incident.verifiedBy?.name ?? "not verified"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No incidents have been recorded yet.</p>
              )}
            </article>

            <article className="panel details-panel">
              <h2>Maintenance Tasks</h2>
              {overview.maintenanceTasks.length ? (
                <ul className="timeline">
                  {overview.maintenanceTasks.map((task) => (
                    <li key={task.id}>
                      <Link className="text-link" to={`/worklist/${task.id}`}>
                        {task.title}
                      </Link>
                      <span>
                        {task.status} | {task.priority} | updated {formatDateTime(task.updatedAt)}
                      </span>
                      <p>
                        {task.assignedTo?.name ?? "Unassigned"} | {formatAsset(task.asset)} |{" "}
                        {task.zone?.name ?? "No zone"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No maintenance tasks have been recorded yet.</p>
              )}
            </article>

            <article className="panel details-panel">
              <h2>Maintenance Logs</h2>
              {overview.maintenanceLogs.length ? (
                <ul className="timeline">
                  {overview.maintenanceLogs.map((log) => (
                    <li key={log.id}>
                      <Link className="text-link" to={`/worklist/${log.task.id}`}>
                        {log.task.title}
                      </Link>
                      <span>
                        {log.resultingHealth ?? "Logged work"} | {formatDateTime(log.performedAt)}
                      </span>
                      <p>
                        {log.employee?.name ?? "Unknown employee"} | {formatAsset(log.asset)} |{" "}
                        {log.notes ?? "No notes."}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No maintenance logs have been recorded yet.</p>
              )}
            </article>

            <article className="panel details-panel">
              <h2>Asset Health Logs</h2>
              {overview.assetHealthLogs.length ? (
                <ul className="timeline">
                  {overview.assetHealthLogs.map((log) => (
                    <li key={log.id}>
                      <Link className="text-link" to={`/assets/${log.asset.id}`}>
                        {formatAsset(log.asset)}
                      </Link>
                      <span>
                        {log.status} | {log.source} | {formatDateTime(log.recordedAt)}
                      </span>
                      <p>{log.notes ?? "No notes."}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No health logs have been recorded yet.</p>
              )}
            </article>
          </section>

          <p className="muted-text">Last refreshed {formatDateTime(overview.generatedAt)}.</p>
        </>
      ) : null}
    </section>
  );
};
