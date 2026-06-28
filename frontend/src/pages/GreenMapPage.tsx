import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Link, useSearchParams } from "react-router";
import { MapContainer, Marker, Polygon, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import { getZonePolygons } from "../map/zoneBoundaries";

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
  metadata: { photoUrl?: string } | null;
  zone: { id: string; name: string } | null;
};

type Zone = {
  id: string;
  name: string;
  description: string | null;
  boundary: unknown;
};

type MapBoundsProps = {
  assets: GreenAsset[];
  zones: Zone[];
  selectedZoneId: string;
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
const sortOptions = [
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "health-asc", label: "Health" },
  { value: "zone-asc", label: "Zone" },
  { value: "type-asc", label: "Type" }
];
const pageSizeOptions = [6, 12, 24];
const defaultCenter: [number, number] = [42.6977, 23.3219];

const getCoordinates = (asset: GreenAsset): [number, number] => [Number(asset.latitude), Number(asset.longitude)];
const getAssetPhotoUrl = (asset: GreenAsset) =>
  typeof asset.metadata?.photoUrl === "string" ? asset.metadata.photoUrl : "";
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

const MapBounds = ({ assets, zones, selectedZoneId }: MapBoundsProps) => {
  const map = useMap();

  useEffect(() => {
    const selectedZone = zones.find((zone) => zone.id === selectedZoneId);
    const selectedZoneCoordinates = selectedZone
      ? getZonePolygons(selectedZone.boundary).flat()
      : [];

    if (selectedZoneCoordinates.length >= 3) {
      map.fitBounds(L.latLngBounds(selectedZoneCoordinates), { padding: [42, 42], maxZoom: 15 });
      return;
    }

    const validAssets = assets.filter(
      (asset) => Number.isFinite(Number(asset.latitude)) && Number.isFinite(Number(asset.longitude))
    );

    if (validAssets.length === 0) {
      map.setView(defaultCenter, 12);
      return;
    }

    const bounds = L.latLngBounds(validAssets.map(getCoordinates));
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
  }, [assets, map, selectedZoneId, zones]);

  return null;
};

export const GreenMapPage = () => {
  const { hasRole } = useAuth();
  const [searchParams] = useSearchParams();
  const [assets, setAssets] = useState<GreenAsset[]>([]);
  const [healthStatus, setHealthStatus] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [species, setSpecies] = useState("");
  const [zoneId, setZoneId] = useState(() => searchParams.get("zoneId") ?? "");
  const [sortBy, setSortBy] = useState("name-asc");
  const [pageSize, setPageSize] = useState(12);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);

  const query = useMemo(() => {
    const params = new URLSearchParams();

    if (healthStatus) {
      params.set("healthStatus", healthStatus);
    }

    if (typeFilter) {
      params.set("type", typeFilter);
    }

    if (species.trim()) {
      params.set("species", species.trim());
    }

    if (zoneId) {
      params.set("zoneId", zoneId);
    }

    const value = params.toString();
    return value ? `?${value}` : "";
  }, [healthStatus, species, typeFilter, zoneId]);

  const sortedAssets = useMemo(() => {
    return [...assets].sort((left, right) => {
      const leftName = (left.commonName ?? left.species).toLowerCase();
      const rightName = (right.commonName ?? right.species).toLowerCase();

      switch (sortBy) {
        case "name-desc":
          return rightName.localeCompare(leftName);
        case "health-asc":
          return left.healthStatus.localeCompare(right.healthStatus) || leftName.localeCompare(rightName);
        case "zone-asc":
          return (left.zone?.name ?? "Unassigned").localeCompare(right.zone?.name ?? "Unassigned") || leftName.localeCompare(rightName);
        case "type-asc":
          return left.type.localeCompare(right.type) || leftName.localeCompare(rightName);
        default:
          return leftName.localeCompare(rightName);
      }
    });
  }, [assets, sortBy]);
  const pageCount = Math.max(1, Math.ceil(sortedAssets.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedAssets = sortedAssets.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

  useEffect(() => {
    setPage(1);
  }, [healthStatus, pageSize, sortBy, species, typeFilter, zoneId]);

  useEffect(() => {
    apiRequest<Zone[]>("/zones")
      .then(setZones)
      .catch(() => setZones([]));
  }, []);

  const canManageAssets = hasRole("EMPLOYEE", "MANAGER", "ADMIN");

  return (
    <section className="page">
      <h1>Green Map</h1>
      <p>Browse registered trees and green assets by species, health status, and zone.</p>

      {canManageAssets ? (
        <div className="page-action-row">
          <Link className="primary-link" to="/assets/new">
            Register Asset
          </Link>
        </div>
      ) : null}

      <div className="toolbar">
        <label>
          Species
          <input value={species} onChange={(event) => setSpecies(event.target.value)} placeholder="Oak, Tilia..." />
        </label>
        <label>
          Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">All</option>
            {assetTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
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
        <label>
          Zone
          <select value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
            <option value="">All</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
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
          <MapBounds assets={assets} zones={zones} selectedZoneId={zoneId} />
          {zones.map((zone) =>
            getZonePolygons(zone.boundary).map((positions, index) => {
              const isSelected = zone.id === zoneId;

              return (
                <Polygon
                  key={`${zone.id}:${index}`}
                  positions={positions}
                  pathOptions={{
                    color: isSelected ? "#0f5132" : "#2f855a",
                    fillColor: isSelected ? "#9ae6b4" : "#b9f5d0",
                    fillOpacity: isSelected ? 0.32 : 0.14,
                    opacity: isSelected ? 0.95 : 0.55,
                    weight: isSelected ? 4 : 2
                  }}
                >
                  <Tooltip sticky>{zone.name}</Tooltip>
                  <Popup>
                    <div className="map-popup">
                      <strong>{zone.name}</strong>
                      {zone.description ? <span>{zone.description}</span> : null}
                      <button type="button" className="map-popup-button" onClick={() => setZoneId(zone.id)}>
                        Filter this zone
                      </button>
                    </div>
                  </Popup>
                </Polygon>
              );
            })
          )}
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

      <section className="catalog-panel">
        <div className="catalog-header">
          <div>
            <h2>Asset Catalog</h2>
            <p className="muted-text">
              Showing {paginatedAssets.length} of {sortedAssets.length} matching assets.
            </p>
          </div>
          <div className="catalog-controls">
            <label>
              Sort
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Page size
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="asset-catalog-list">
          {isLoading ? <p>Loading assets...</p> : null}
          {!isLoading && assets.length === 0 ? <p>No assets match the current filters.</p> : null}
          {paginatedAssets.map((asset) => (
            <article className="asset-catalog-card" key={asset.id}>
              {getAssetPhotoUrl(asset) ? (
                <img className="asset-catalog-photo" src={getAssetPhotoUrl(asset)} alt={asset.commonName ?? asset.species} />
              ) : (
                <div className="asset-catalog-photo asset-catalog-photo-placeholder">{asset.type.slice(0, 1)}</div>
              )}
              <div>
                <p className="eyebrow">{asset.type}</p>
                <h2>{asset.commonName ?? asset.species}</h2>
                <p>{asset.description ?? "No description has been added."}</p>
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
        <div className="pagination-row">
          <button type="button" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Previous
          </button>
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage === pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            Next
          </button>
        </div>
      </section>
    </section>
  );
};
