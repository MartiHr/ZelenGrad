import { useEffect, useMemo, useState, type FormEvent } from "react";
import L from "leaflet";
import { Link, useSearchParams } from "react-router";
import { MapContainer, Marker, Polygon, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { ApiError, apiRequest, uploadAssetImage } from "../api";
import { useAuth } from "../auth/AuthContext";
import { getZonePolygons } from "../map/zoneBoundaries";
import {
  validateCoordinate,
  validateOptionalImageFile,
  validateRequiredText,
  type FieldErrors
} from "../validation";

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

type MapClickHandlerProps = {
  onPickCoordinates: (latitude: string, longitude: string) => void;
};

type AssetCreateField = "species" | "latitude" | "longitude" | "plantedAt" | "photo";

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
const sortOptions = [
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "health-asc", label: "Health" },
  { value: "zone-asc", label: "Zone" },
  { value: "type-asc", label: "Type" }
];
const pageSizeOptions = [6, 12, 24];
const defaultCenter: [number, number] = [42.6977, 23.3219];
const maxPhotoBytes = 5 * 1024 * 1024;

const getCoordinates = (asset: GreenAsset): [number, number] => [Number(asset.latitude), Number(asset.longitude)];
const getAssetPhotoUrl = (asset: GreenAsset) =>
  typeof asset.metadata?.photoUrl === "string" ? asset.metadata.photoUrl : "";
const getDraftCoordinates = (latitude: string, longitude: string): [number, number] | null => {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    return null;
  }

  return [parsedLatitude, parsedLongitude];
};
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

const draftLocationIcon = L.divIcon({
  className: "draft-asset-marker",
  html: "<span></span>",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

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
  const [assetType, setAssetType] = useState("TREE");
  const [assetCommonName, setAssetCommonName] = useState("");
  const [assetSpecies, setAssetSpecies] = useState("");
  const [assetDescription, setAssetDescription] = useState("");
  const [assetLatitude, setAssetLatitude] = useState("");
  const [assetLongitude, setAssetLongitude] = useState("");
  const [assetPhotoUrl, setAssetPhotoUrl] = useState("");
  const [assetPhotoFile, setAssetPhotoFile] = useState<File | null>(null);
  const [assetPhotoPreviewUrl, setAssetPhotoPreviewUrl] = useState("");
  const [assetHealthStatus, setAssetHealthStatus] = useState("HEALTHY");
  const [assetPlantedAt, setAssetPlantedAt] = useState("");
  const [assetZoneId, setAssetZoneId] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<FieldErrors<AssetCreateField>>({});
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isCreatingAsset, setIsCreatingAsset] = useState(false);
  const draftCoordinates = getDraftCoordinates(assetLatitude, assetLongitude);

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

  useEffect(() => {
    return () => {
      if (assetPhotoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(assetPhotoPreviewUrl);
      }
    };
  }, [assetPhotoPreviewUrl]);

  const canManageAssets = hasRole("EMPLOYEE", "MANAGER", "ADMIN");

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location is not available in this browser.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAssetLatitude(position.coords.latitude.toFixed(6));
        setAssetLongitude(position.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      () => {
        setLocationError("Could not read your current location. Check browser permissions.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const choosePhotoFile = (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setCreateError("Choose an image file for the asset photo.");
      setCreateFieldErrors({ photo: "Photo must be an image file." });
      return;
    }

    if (file.size > maxPhotoBytes) {
      setCreateError("Choose an image under 5 MB.");
      setCreateFieldErrors({ photo: "Photo must be under 5 MB." });
      return;
    }

    if (assetPhotoPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(assetPhotoPreviewUrl);
    }

    setAssetPhotoFile(file);
    setAssetPhotoPreviewUrl(URL.createObjectURL(file));
    setAssetPhotoUrl("");
    setCreateError(null);
    setCreateFieldErrors((current) => ({ ...current, photo: undefined }));
  };

  const clearSelectedPhoto = () => {
    if (assetPhotoPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(assetPhotoPreviewUrl);
    }

    setAssetPhotoFile(null);
    setAssetPhotoPreviewUrl("");
    setAssetPhotoUrl("");
  };

  const validateAssetForm = () => {
    const nextFieldErrors: FieldErrors<AssetCreateField> = {};
    const speciesError = validateRequiredText(assetSpecies, "Species");
    const latitudeError = validateCoordinate(assetLatitude, "Latitude");
    const longitudeError = validateCoordinate(assetLongitude, "Longitude");
    const photoError = validateOptionalImageFile(assetPhotoFile, "Asset photo");

    if (speciesError) {
      nextFieldErrors.species = speciesError;
    }

    if (latitudeError) {
      nextFieldErrors.latitude = latitudeError;
    }

    if (longitudeError) {
      nextFieldErrors.longitude = longitudeError;
    }

    if (assetPlantedAt && new Date(assetPlantedAt).getTime() > Date.now()) {
      nextFieldErrors.plantedAt = "Planted date cannot be in the future.";
    }

    if (assetPhotoUrl.trim() && assetPhotoFile) {
      nextFieldErrors.photo = "Use either a photo URL or an uploaded photo, not both.";
    } else if (photoError) {
      nextFieldErrors.photo = photoError;
    }

    return nextFieldErrors;
  };

  const createGreenAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setCreateError("Please log in before registering an asset.");
      return;
    }

    const nextFieldErrors = validateAssetForm();
    if (Object.keys(nextFieldErrors).length > 0) {
      setCreateFieldErrors(nextFieldErrors);
      setCreateError("Fix the highlighted asset fields before registering.");
      setCreateSuccess(null);
      return;
    }

    setIsCreatingAsset(true);
    setCreateError(null);
    setCreateFieldErrors({});
    setCreateSuccess(null);

    try {
      const savedPhotoUrl = assetPhotoFile ? await uploadAssetImage(assetPhotoFile, token) : assetPhotoUrl.trim();
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
          healthStatus: assetHealthStatus,
          zoneId: assetZoneId || undefined,
          photoUrl: savedPhotoUrl || undefined
        }
      });

      setCreateSuccess(`Registered ${createdAsset.commonName ?? createdAsset.species}.`);
      setAssetCommonName("");
      setAssetSpecies("");
      setAssetDescription("");
      setAssetLatitude("");
      setAssetLongitude("");
      clearSelectedPhoto();
      setAssetPlantedAt("");
      setAssetZoneId("");
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
          {canManageAssets ? (
            <MapClickHandler
              onPickCoordinates={(latitude, longitude) => {
                setAssetLatitude(latitude);
                setAssetLongitude(longitude);
              }}
            />
          ) : null}
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
          {draftCoordinates ? (
            <Marker position={draftCoordinates} icon={draftLocationIcon}>
              <Popup>
                <div className="map-popup">
                  <strong>New asset location</strong>
                  <span>
                    {assetLatitude}, {assetLongitude}
                  </span>
                </div>
              </Popup>
            </Marker>
          ) : null}
        </MapContainer>
      </div>

      {canManageAssets ? (
        <article className="panel details-panel">
          <h2>Register Asset</h2>
          <p className="muted-text">Tap the map or use device GPS, then add the registry details and optional photo.</p>
          <form className="inline-form asset-form" onSubmit={(event) => void createGreenAsset(event)} noValidate>
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
                  aria-invalid={Boolean(createFieldErrors.species)}
                  value={assetSpecies}
                  onChange={(event) => setAssetSpecies(event.target.value)}
                  maxLength={160}
                  required
                  placeholder="Quercus robur"
                />
                {createFieldErrors.species ? <span className="field-error">{createFieldErrors.species}</span> : null}
              </label>
              <label>
                Latitude
                <input
                  aria-invalid={Boolean(createFieldErrors.latitude)}
                  value={assetLatitude}
                  onChange={(event) => setAssetLatitude(event.target.value)}
                  required
                  type="number"
                  step="0.000001"
                />
                {createFieldErrors.latitude ? <span className="field-error">{createFieldErrors.latitude}</span> : null}
              </label>
              <label>
                Longitude
                <input
                  aria-invalid={Boolean(createFieldErrors.longitude)}
                  value={assetLongitude}
                  onChange={(event) => setAssetLongitude(event.target.value)}
                  required
                  type="number"
                  step="0.000001"
                />
                {createFieldErrors.longitude ? <span className="field-error">{createFieldErrors.longitude}</span> : null}
              </label>
              <div className="field-action">
                <span>Coordinates</span>
                <button type="button" className="secondary-action" disabled={isLocating} onClick={useCurrentLocation}>
                  {isLocating ? "Locating..." : "Use Current Location"}
                </button>
              </div>
              <label>
                Planted
                <input
                  aria-invalid={Boolean(createFieldErrors.plantedAt)}
                  type="date"
                  value={assetPlantedAt}
                  onChange={(event) => setAssetPlantedAt(event.target.value)}
                />
                {createFieldErrors.plantedAt ? <span className="field-error">{createFieldErrors.plantedAt}</span> : null}
              </label>
              <label>
                Zone
                <select value={assetZoneId} onChange={(event) => setAssetZoneId(event.target.value)}>
                  <option value="">Unassigned</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {locationError ? <p className="form-error">{locationError}</p> : null}
            <label>
              Description
              <textarea
                value={assetDescription}
                onChange={(event) => setAssetDescription(event.target.value)}
                maxLength={1000}
                placeholder="Short registry note"
              />
            </label>
            <div className="photo-registration-grid">
              <label>
                Photo URL
                <input
                  aria-invalid={Boolean(createFieldErrors.photo)}
                  value={assetPhotoUrl}
                  onChange={(event) => {
                    if (assetPhotoPreviewUrl.startsWith("blob:")) {
                      URL.revokeObjectURL(assetPhotoPreviewUrl);
                    }

                    setAssetPhotoFile(null);
                    setAssetPhotoPreviewUrl("");
                    setAssetPhotoUrl(event.target.value);
                    setCreateFieldErrors((current) => ({ ...current, photo: undefined }));
                  }}
                  placeholder="https://example.com/tree-photo.jpg"
                />
              </label>
              <label>
                Upload photo
                <input
                  aria-invalid={Boolean(createFieldErrors.photo)}
                  type="file"
                  accept="image/*"
                  onChange={(event) => choosePhotoFile(event.target.files?.[0])}
                />
              </label>
              {assetPhotoPreviewUrl || assetPhotoUrl ? (
                <figure className="asset-photo-preview">
                  <img src={assetPhotoPreviewUrl || assetPhotoUrl} alt="Selected asset preview" />
                  <button type="button" className="muted-button" onClick={clearSelectedPhoto}>
                    Remove Photo
                  </button>
                </figure>
              ) : null}
              {createFieldErrors.photo ? <span className="field-error">{createFieldErrors.photo}</span> : null}
            </div>
            {createError ? <p className="form-error">{createError}</p> : null}
            {createSuccess ? <p className="form-success">{createSuccess}</p> : null}
            <button type="submit" disabled={isCreatingAsset}>
              {isCreatingAsset ? "Registering..." : "Register Asset"}
            </button>
          </form>
        </article>
      ) : null}

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
