import { useEffect, useState, type FormEvent } from "react";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";

type Zone = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: {
    assets: number;
    tasks: number;
    incidents: number;
    assignments: number;
  };
};

export const ZonesPage = () => {
  const { token } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const loadZones = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setZones(await apiRequest<Zone[]>("/zones"));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not load zones.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadZones();
  }, []);

  const createZone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setCreateError("Please log in before creating a zone.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const zone = await apiRequest<Zone>("/zones", {
        method: "POST",
        token,
        body: {
          name,
          description: description.trim() || undefined
        }
      });

      setZones((current) => [...current, zone].sort((left, right) => left.name.localeCompare(right.name)));
      setName("");
      setDescription("");
      setCreateSuccess(`Created ${zone.name}.`);
    } catch (caughtError) {
      setCreateError(caughtError instanceof ApiError ? caughtError.message : "Could not create zone.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="page">
      <h1>Zones Management</h1>
      <p>Manage municipal areas used to organize green assets, incidents, and maintenance work.</p>

      <article className="panel details-panel">
        <h2>Create Zone</h2>
        <form className="inline-form" onSubmit={(event) => void createZone(event)}>
          <div className="form-grid">
            <label>
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                minLength={2}
                required
                placeholder="University District"
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              placeholder="Short operational note for this zone."
            />
          </label>
          {createError ? <p className="form-error">{createError}</p> : null}
          {createSuccess ? <p className="form-success">{createSuccess}</p> : null}
          <button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Zone"}
          </button>
        </form>
      </article>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="asset-grid">
        {isLoading ? <p>Loading zones...</p> : null}
        {!isLoading && zones.length === 0 ? <p>No zones have been created yet.</p> : null}
        {zones.map((zone) => (
          <article className="asset-card" key={zone.id}>
            <div>
              <p className="eyebrow">Zone</p>
              <h2>{zone.name}</h2>
            </div>
            <p>{zone.description ?? "No description has been added for this zone yet."}</p>
            <dl>
              <div>
                <dt>Assets</dt>
                <dd>{zone._count.assets}</dd>
              </div>
              <div>
                <dt>Tasks</dt>
                <dd>{zone._count.tasks}</dd>
              </div>
              <div>
                <dt>Incidents</dt>
                <dd>{zone._count.incidents}</dd>
              </div>
              <div>
                <dt>Assignments</dt>
                <dd>{zone._count.assignments}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
};
