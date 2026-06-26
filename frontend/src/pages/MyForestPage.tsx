import { useEffect, useState } from "react";
import { Link } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";

type Adoption = {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  asset: {
    id: string;
    type: string;
    commonName: string | null;
    species: string;
    description: string | null;
    latitude: string;
    longitude: string;
    healthStatus: string;
    lifecycleStatus: string;
    zone: { id: string; name: string } | null;
  };
  _count: {
    careLogs: number;
  };
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(value));
};

export const MyForestPage = () => {
  const { token, user } = useAuth();
  const [adoptions, setAdoptions] = useState<Adoption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    apiRequest<Adoption[]>("/adoptions/me", { token })
      .then(setAdoptions)
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load your forest.");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  return (
    <section className="page">
      <div className="details-header">
        <div>
          <h1>My Forest</h1>
          <p>Track your adopted trees, care activity, and green points.</p>
        </div>
        <div className="points-pill">{user?.greenPoints ?? 0} points</div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="asset-grid">
        {isLoading ? <p>Loading your adopted trees...</p> : null}
        {!isLoading && adoptions.length === 0 ? (
          <article className="panel details-panel">
            <h2>No adopted trees yet</h2>
            <p>Open the green map, choose a tree, and adopt it from the asset details page.</p>
            <Link className="text-link" to="/map">
              Browse map
            </Link>
          </article>
        ) : null}

        {adoptions.map((adoption) => (
          <article className="asset-card" key={adoption.id}>
            <div>
              <p className="eyebrow">{adoption.status}</p>
              <h2>{adoption.asset.commonName ?? adoption.asset.species}</h2>
            </div>
            <p>{adoption.asset.description ?? "No description has been added for this tree yet."}</p>
            <dl>
              <div>
                <dt>Species</dt>
                <dd>{adoption.asset.species}</dd>
              </div>
              <div>
                <dt>Health</dt>
                <dd>{adoption.asset.healthStatus}</dd>
              </div>
              <div>
                <dt>Zone</dt>
                <dd>{adoption.asset.zone?.name ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt>Adopted</dt>
                <dd>{formatDate(adoption.startedAt)}</dd>
              </div>
              <div>
                <dt>Care logs</dt>
                <dd>{adoption._count.careLogs}</dd>
              </div>
            </dl>
            <div className="button-row">
              <Link to={`/assets/${adoption.asset.id}`}>Open details</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
