import { useEffect, useState } from "react";
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

export const AuditPage = () => {
  const { token } = useAuth();
  const [overview, setOverview] = useState<AuditOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
