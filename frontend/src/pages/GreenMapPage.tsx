import { useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "../api";

type GreenAsset = {
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

export const GreenMapPage = () => {
  const [assets, setAssets] = useState<GreenAsset[]>([]);
  const [healthStatus, setHealthStatus] = useState("");
  const [species, setSpecies] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();

    if (healthStatus) {
      params.set("healthStatus", healthStatus);
    }

    if (species.trim()) {
      params.set("species", species.trim());
    }

    const value = params.toString();
    return value ? `?${value}` : "";
  }, [healthStatus, species]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    apiRequest<GreenAsset[]>(`/assets${query}`)
      .then(setAssets)
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load green assets.");
      })
      .finally(() => setIsLoading(false));
  }, [query]);

  return (
    <section className="page">
      <h1>Green Map</h1>
      <p>Browse registered trees and green assets by species, health status, and zone.</p>

      <div className="toolbar">
        <label>
          Species
          <input value={species} onChange={(event) => setSpecies(event.target.value)} placeholder="Oak, Tilia..." />
        </label>
        <label>
          Health
          <select value={healthStatus} onChange={(event) => setHealthStatus(event.target.value)}>
            <option value="">All</option>
            <option value="HEALTHY">Healthy</option>
            <option value="NEEDS_ATTENTION">Needs attention</option>
            <option value="DRY">Dry</option>
            <option value="DISEASED">Diseased</option>
            <option value="DAMAGED">Damaged</option>
          </select>
        </label>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="asset-grid">
        {isLoading ? <p>Loading assets...</p> : null}
        {!isLoading && assets.length === 0 ? <p>No assets match the current filters.</p> : null}
        {assets.map((asset) => (
          <article className="asset-card" key={asset.id}>
            <div>
              <p className="eyebrow">{asset.type}</p>
              <h2>{asset.commonName ?? asset.species}</h2>
            </div>
            <dl>
              <div>
                <dt>Species</dt>
                <dd>{asset.species}</dd>
              </div>
              <div>
                <dt>Health</dt>
                <dd>{asset.healthStatus}</dd>
              </div>
              <div>
                <dt>Zone</dt>
                <dd>{asset.zone?.name ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt>Coordinates</dt>
                <dd>
                  {asset.latitude}, {asset.longitude}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
};
