import { useEffect, useState, type FormEvent } from "react";
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
    metadata: { photoUrl?: string } | null;
    zone: { id: string; name: string } | null;
  };
  _count: {
    careLogs: number;
  };
  careLogs: CareLog[];
};

type CareLog = {
  id: string;
  notes: string | null;
  photoUrls: string[];
  loggedAt: string;
};

type RewardTransaction = {
  id: string;
  points: number;
  reason: string;
  description: string | null;
  createdAt: string;
};

type CareFormState = {
  notes: string;
  photoUrl: string;
  error: string | null;
  success: string | null;
  isSubmitting: boolean;
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(value));
};

const createInitialCareForm = (): CareFormState => ({
  notes: "",
  photoUrl: "",
  error: null,
  success: null,
  isSubmitting: false
});

export const MyForestPage = () => {
  const { refreshUser, token, user } = useAuth();
  const [adoptions, setAdoptions] = useState<Adoption[]>([]);
  const [rewards, setRewards] = useState<RewardTransaction[]>([]);
  const [careForms, setCareForms] = useState<Record<string, CareFormState>>({});
  const [error, setError] = useState<string | null>(null);
  const [rewardError, setRewardError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRewards, setIsLoadingRewards] = useState(true);

  const loadAdoptions = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextAdoptions = await apiRequest<Adoption[]>("/adoptions/me", { token });
      setAdoptions(nextAdoptions);
      setCareForms((current) =>
        nextAdoptions.reduce<Record<string, CareFormState>>((forms, adoption) => {
          forms[adoption.id] = current[adoption.id] ?? createInitialCareForm();
          return forms;
        }, {})
      );
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not load your forest.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAdoptions();
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    setIsLoadingRewards(true);
    setRewardError(null);

    apiRequest<RewardTransaction[]>("/rewards/me", { token })
      .then(setRewards)
      .catch((caughtError) => {
        setRewardError(caughtError instanceof ApiError ? caughtError.message : "Could not load reward history.");
      })
      .finally(() => setIsLoadingRewards(false));
  }, [token]);

  const updateCareForm = (adoptionId: string, patch: Partial<CareFormState>) => {
    setCareForms((current) => ({
      ...current,
      [adoptionId]: {
        ...(current[adoptionId] ?? createInitialCareForm()),
        ...patch
      }
    }));
  };

  const submitCareLog = async (event: FormEvent<HTMLFormElement>, adoptionId: string) => {
    event.preventDefault();

    if (!token) {
      updateCareForm(adoptionId, { error: "Please log in before logging care." });
      return;
    }

    const form = careForms[adoptionId] ?? createInitialCareForm();
    const photoUrl = form.photoUrl.trim();

    updateCareForm(adoptionId, { error: null, success: null, isSubmitting: true });

    try {
      const careLog = await apiRequest<CareLog>(`/adoptions/${adoptionId}/care-logs`, {
        method: "POST",
        token,
        body: {
          notes: form.notes.trim() || undefined,
          photoUrls: photoUrl ? [photoUrl] : []
        }
      });

      setAdoptions((current) =>
        current.map((adoption) =>
          adoption.id === adoptionId
            ? {
                ...adoption,
                careLogs: [careLog, ...adoption.careLogs],
                _count: { careLogs: adoption._count.careLogs + 1 }
              }
            : adoption
        )
      );
      updateCareForm(adoptionId, {
        notes: "",
        photoUrl: "",
        success: `Care logged on ${formatDate(careLog.loggedAt)}.`,
        isSubmitting: false
      });
      await refreshUser();
    } catch (caughtError) {
      updateCareForm(adoptionId, {
        error: caughtError instanceof ApiError ? caughtError.message : "Could not log care.",
        isSubmitting: false
      });
    }
  };

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

      <section className="forest-overview-grid">
        <article className="panel details-panel">
          <h2>Reward History</h2>
          {rewardError ? <p className="form-error">{rewardError}</p> : null}
          {isLoadingRewards ? <p>Loading reward history...</p> : null}
          {!isLoadingRewards && rewards.length === 0 ? <p>No reward transactions have been recorded yet.</p> : null}
          {rewards.length ? (
            <ul className="timeline compact-timeline">
              {rewards.slice(0, 8).map((reward) => (
                <li key={reward.id}>
                  <strong>
                    {reward.points > 0 ? "+" : ""}
                    {reward.points} points
                  </strong>
                  <span>
                    {reward.reason} | {formatDate(reward.createdAt)}
                  </span>
                  <p>{reward.description ?? "No description was added."}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </article>

        <article className="panel details-panel">
          <h2>Forest Snapshot</h2>
          <dl className="asset-quick-stats">
            <div>
              <dt>Adoptions</dt>
              <dd>{adoptions.length}</dd>
            </div>
            <div>
              <dt>Care logs</dt>
              <dd>{adoptions.reduce((total, adoption) => total + adoption._count.careLogs, 0)}</dd>
            </div>
            <div>
              <dt>Green points</dt>
              <dd>{user?.greenPoints ?? 0}</dd>
            </div>
          </dl>
        </article>
      </section>

      <div className="forest-card-grid">
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

        {adoptions.map((adoption) => {
          const form = careForms[adoption.id] ?? createInitialCareForm();

          return (
            <article className="asset-card forest-card" key={adoption.id}>
            {typeof adoption.asset.metadata?.photoUrl === "string" ? (
              <img
                className="asset-card-photo"
                src={adoption.asset.metadata.photoUrl}
                alt={adoption.asset.commonName ?? adoption.asset.species}
              />
            ) : null}
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
            <form className="inline-form care-form" onSubmit={(event) => void submitCareLog(event, adoption.id)}>
              <label>
                Care notes
                <textarea
                  value={form.notes}
                  onChange={(event) => updateCareForm(adoption.id, { notes: event.target.value })}
                  maxLength={1000}
                  placeholder="Watered, checked soil, removed litter..."
                />
              </label>
              <label>
                Photo URL
                <input
                  value={form.photoUrl}
                  onChange={(event) => updateCareForm(adoption.id, { photoUrl: event.target.value })}
                  placeholder="https://example.com/photo.jpg"
                  type="url"
                />
              </label>
              {form.error ? <p className="form-error">{form.error}</p> : null}
              {form.success ? <p className="form-success">{form.success}</p> : null}
              <button type="submit" disabled={form.isSubmitting}>
                {form.isSubmitting ? "Logging..." : "Log Care"}
              </button>
            </form>
            <section className="care-history">
              <h3>Care History</h3>
              {adoption.careLogs.length === 0 ? <p>No care logs have been submitted yet.</p> : null}
              {adoption.careLogs.length ? (
                <ul className="timeline">
                  {adoption.careLogs.map((careLog) => (
                    <li key={careLog.id}>
                      <strong>{formatDate(careLog.loggedAt)}</strong>
                      <p>{careLog.notes ?? "No notes were added."}</p>
                      {careLog.photoUrls.length ? (
                        <div className="photo-gallery">
                          {careLog.photoUrls.map((photoUrl) => (
                            <a className="photo-thumb" href={photoUrl} key={photoUrl} rel="noreferrer" target="_blank">
                              <img src={photoUrl} alt="Care log evidence" />
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </article>
          );
        })}
      </div>
    </section>
  );
};
