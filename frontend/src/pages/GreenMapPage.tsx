import { useEffect, useMemo, useState, type FormEvent } from "react";
import L from "leaflet";
import { Link } from "react-router";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";

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

type MapClickHandlerProps = {
  onPickCoordinates: (latitude: string, longitude: string) => void;
};

const healthColors: Record<string, string> = {
  HEALTHY: "#12633f",
  NEEDS_ATTENTION: "#b7791f",
  DRY: "#9d2c2c",
  DISEASED: "#7c3aed",
  DAMAGED: "#c2410c",
  REMOVED: "#60756c"
};

const assetTypes = ["TREE", "PARK", "SHRUB", "GARDEN"];
const healthStatuses = ["HEALTHY", "NEEDS_ATTENTION", "DRY", "DISEASED", "DAMAGED"];
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

const MapClickHandler = ({ onPickCoordinates }: MapClickHandlerProps) => {
  useMapEvents({
    click: (event) => {
      onPickCoordinates(event.latlng.lat.toFixed(6), event.latlng.lng.toFixed(6));
    }
  });

  return null;
};

export const GreenMapPage = () => {
  const { hasRole, token } = useAuth();
  const [assets, setAssets] = useState<GreenAsset[]>([]);
  const [healthStatus, setHealthStatus] = useState("");
  const [species, setSpecies] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assetType, setAssetType] = useState("TREE");
  const [assetCommonName, setAssetCommonName] = useState("");
  const [assetSpecies, setAssetSpecies] = useState("");
  const [assetDescription, setAssetDescription] = useState("");
  const [assetLatitude, setAssetLatitude] = useState("");
  const [assetLongitude, setAssetLongitude] = useState("");
  const [assetHealthStatus, setAssetHealthStatus] = useState("HEALTHY");
  const [assetPlantedAt, setAssetPlantedAt] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [isCreatingAsset, setIsCreatingAsset] = useState(false);

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

  const loadAssets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setAssets(await apiRequest<GreenAsset[]>(`/assets${query}`));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not load green assets.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAssets();
  }, [query]);

  const canManageAssets = hasRole("EMPLOYEE", "MANAGER", "ADMIN");

  const createGreenAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setCreateError("Please log in before registering an asset.");
      return;
    }

    setIsCreatingAsset(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const createdAsset = await apiRequest<GreenAsset>("/assets", {
        method: "POST",
        token,
        body: {
          type: assetType,
          commonName: assetCommonName.trim() || undefined,
          species: assetSpecies,
          description: assetDescription.trim() || undefined,
          latitude: assetLatitude,
          longitude: assetLongitude,
          plantedAt: assetPlantedAt || undefined,
          healthStatus: assetHealthStatus
        }
      });

      setCreateSuccess(`Registered ${createdAsset.commonName ?? createdAsset.species}.`);
      setAssetCommonName("");
      setAssetSpecies("");
      setAssetDescription("");
      setAssetLatitude("");
      setAssetLongitude("");
      setAssetPlantedAt("");
      setAssetType("TREE");
      setAssetHealthStatus("HEALTHY");
      await loadAssets();
    } catch (caughtError) {
      setCreateError(caughtError instanceof ApiError ? caughtError.message : "Could not register green asset.");
    } finally {
      setIsCreatingAsset(false);
    }
  };

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
          {canManageAssets ? (
            <MapClickHandler
              onPickCoordinates={(latitude, longitude) => {
                setAssetLatitude(latitude);
                setAssetLongitude(longitude);
              }}
            />
          ) : null}
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

      {canManageAssets ? (
        <article className="panel details-panel">
          <h2>Register Asset</h2>
          <form className="inline-form asset-form" onSubmit={(event) => void createGreenAsset(event)}>
            <div className="form-grid">
              <label>
                Type
                <select value={assetType} onChange={(event) => setAssetType(event.target.value)}>
                  {assetTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Health
                <select value={assetHealthStatus} onChange={(event) => setAssetHealthStatus(event.target.value)}>
                  {healthStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Common name
                <input
                  value={assetCommonName}
                  onChange={(event) => setAssetCommonName(event.target.value)}
                  maxLength={120}
                  placeholder="Central oak"
                />
              </label>
              <label>
                Species
                <input
                  value={assetSpecies}
                  onChange={(event) => setAssetSpecies(event.target.value)}
                  maxLength={160}
                  required
                  placeholder="Quercus robur"
                />
              </label>
              <label>
                Latitude
                <input
                  value={assetLatitude}
                  onChange={(event) => setAssetLatitude(event.target.value)}
                  required
                  type="number"
                  step="0.000001"
                />
              </label>
              <label>
                Longitude
                <input
                  value={assetLongitude}
                  onChange={(event) => setAssetLongitude(event.target.value)}
                  required
                  type="number"
                  step="0.000001"
                />
              </label>
              <label>
                Planted
                <input type="date" value={assetPlantedAt} onChange={(event) => setAssetPlantedAt(event.target.value)} />
              </label>
            </div>
            <label>
              Description
              <textarea
                value={assetDescription}
                onChange={(event) => setAssetDescription(event.target.value)}
                maxLength={1000}
                placeholder="Short registry note"
              />
            </label>
            {createError ? <p className="form-error">{createError}</p> : null}
            {createSuccess ? <p className="form-success">{createSuccess}</p> : null}
            <button type="submit" disabled={isCreatingAsset}>
              {isCreatingAsset ? "Registering..." : "Register Asset"}
            </button>
          </form>
        </article>
      ) : null}

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
            <div className="button-row">
              <Link to={`/assets/${asset.id}`}>Open details</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
