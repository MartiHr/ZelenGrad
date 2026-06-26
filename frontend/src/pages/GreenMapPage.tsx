import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Link } from "react-router";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

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

type MapBoundsProps = {
  assets: GreenAsset[];
};

const healthColors: Record<string, string> = {
  HEALTHY: "#12633f",
  NEEDS_ATTENTION: "#b7791f",
  DRY: "#9d2c2c",
  DISEASED: "#7c3aed",
  DAMAGED: "#c2410c",
  REMOVED: "#60756c"
};

const defaultCenter: [number, number] = [42.6977, 23.3219];

const getCoordinates = (asset: GreenAsset): [number, number] => [Number(asset.latitude), Number(asset.longitude)];

const getMarkerIcon = (healthStatus: string) => {
  const color = healthColors[healthStatus] ?? "#12633f";

  return L.divIcon({
    className: "asset-marker",
    html: `<span style="background:${color}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12]
  });
};

const MapBounds = ({ assets }: MapBoundsProps) => {
  const map = useMap();

  useEffect(() => {
    const validAssets = assets.filter(
      (asset) => Number.isFinite(Number(asset.latitude)) && Number.isFinite(Number(asset.longitude))
    );

    if (validAssets.length === 0) {
      map.setView(defaultCenter, 12);
      return;
    }

    const bounds = L.latLngBounds(validAssets.map(getCoordinates));
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
  }, [assets, map]);

  return null;
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

      <div className="map-panel">
        <MapContainer center={defaultCenter} zoom={12} scrollWheelZoom className="green-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBounds assets={assets} />
          {assets.map((asset) => (
            <Marker key={asset.id} position={getCoordinates(asset)} icon={getMarkerIcon(asset.healthStatus)}>
              <Popup>
                <div className="map-popup">
                  <strong>{asset.commonName ?? asset.species}</strong>
                  <span>{asset.species}</span>
                  <span>{asset.healthStatus}</span>
                  <span>{asset.zone?.name ?? "Unassigned zone"}</span>
                  <Link to={`/assets/${asset.id}`}>Open details</Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

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
