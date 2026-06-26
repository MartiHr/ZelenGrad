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
  const [careForms, setCareForms] = useState<Record<string, CareFormState>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

        {adoptions.map((adoption) => {
          const form = careForms[adoption.id] ?? createInitialCareForm();

          return (
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
                        <div className="photo-links">
                          {careLog.photoUrls.map((photoUrl) => (
                            <a href={photoUrl} key={photoUrl} rel="noreferrer" target="_blank">
                              Photo
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
