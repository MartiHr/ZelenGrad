import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";

type RewardTransaction = {
  id: string;
  points: number;
  reason: string;
  description: string | null;
  createdAt: string;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export const ProfilePage = () => {
  const { token, user } = useAuth();
  const [rewards, setRewards] = useState<RewardTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    apiRequest<RewardTransaction[]>("/rewards/me", { token })
      .then(setRewards)
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load reward history.");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  return (
    <section className="page narrow">
      <h1>User Profile</h1>
      <div className="panel profile-summary">
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{user?.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{user?.role}</dd>
          </div>
          <div>
            <dt>Green Points</dt>
            <dd>{user?.greenPoints}</dd>
          </div>
        </dl>
      </div>

      <article className="panel details-panel">
        <h2>Reward History</h2>
        {error ? <p className="form-error">{error}</p> : null}
        {isLoading ? <p>Loading reward history...</p> : null}
        {!isLoading && rewards.length === 0 ? <p>No reward transactions have been recorded yet.</p> : null}
        {rewards.length ? (
          <ul className="timeline">
            {rewards.map((reward) => (
              <li key={reward.id}>
                <strong>
                  {reward.points > 0 ? "+" : ""}
                  {reward.points} points
                </strong>
                <span>
                  {reward.reason} · {formatDate(reward.createdAt)}
                </span>
                <p>{reward.description ?? "No description was added."}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </section>
  );
};
