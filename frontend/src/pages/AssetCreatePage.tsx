import { useEffect, useState, type FormEvent } from "react";
import L from "leaflet";
import { Link, useNavigate } from "react-router";
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
  latitude: string;
  longitude: string;
  healthStatus: string;
  zone: { id: string; name: string } | null;
};

type Zone = {
  id: string;
  name: string;
  description: string | null;
  boundary: unknown;
};

type AssetCreateField = "species" | "latitude" | "longitude" | "plantedAt" | "photo";

type MapBoundsProps = {
  zones: Zone[];
  draftCoordinates: [number, number] | null;
};

type MapClickHandlerProps = {
  onPickCoordinates: (latitude: string, longitude: string) => void;
};

const assetTypes = ["TREE", "PARK", "SHRUB", "GARDEN"];
const healthStatuses = ["HEALTHY", "NEEDS_ATTENTION", "DRY", "DISEASED", "DAMAGED"];
const defaultCenter: [number, number] = [42.6977, 23.3219];
const maxPhotoBytes = 5 * 1024 * 1024;

const getDraftCoordinates = (latitude: string, longitude: string): [number, number] | null => {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    return null;
  }

  return [parsedLatitude, parsedLongitude];
};

const draftLocationIcon = L.divIcon({
  className: "draft-asset-marker",
  html: "<span></span>",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

const MapBounds = ({ draftCoordinates, zones }: MapBoundsProps) => {
  const map = useMap();

  useEffect(() => {
    if (draftCoordinates) {
      map.setView(draftCoordinates, 16);
      return;
    }

    map.setView(defaultCenter, 12);
  }, [draftCoordinates, map, zones]);

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

export const AssetCreatePage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [assets, setAssets] = useState<GreenAsset[]>([]);
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
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isCreatingAsset, setIsCreatingAsset] = useState(false);
  const draftCoordinates = getDraftCoordinates(assetLatitude, assetLongitude);

  useEffect(() => {
    Promise.all([apiRequest<GreenAsset[]>("/assets"), apiRequest<Zone[]>("/zones")])
      .then(([assetsResponse, zonesResponse]) => {
        setAssets(assetsResponse);
        setZones(zonesResponse);
      })
      .catch(() => {
        setAssets([]);
        setZones([]);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (assetPhotoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(assetPhotoPreviewUrl);
      }
    };
  }, [assetPhotoPreviewUrl]);

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
      return;
    }

    setIsCreatingAsset(true);
    setCreateError(null);
    setCreateFieldErrors({});

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

      navigate(`/assets/${createdAsset.id}`);
    } catch (caughtError) {
      setCreateError(caughtError instanceof ApiError ? caughtError.message : "Could not register green asset.");
    } finally {
      setIsCreatingAsset(false);
    }
  };

  return (
    <section className="page narrow-edit">
      <div className="details-header">
        <div>
          <p className="eyebrow">Asset registry</p>
          <h1>Register Asset</h1>
          <p>Pick coordinates from the map or device GPS, then save the registry details and photo.</p>
        </div>
        <Link to="/map">Back to map</Link>
      </div>

      <div className="map-panel">
        <MapContainer center={defaultCenter} zoom={12} scrollWheelZoom className="green-map compact-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler
            onPickCoordinates={(latitude, longitude) => {
              setAssetLatitude(latitude);
              setAssetLongitude(longitude);
            }}
          />
          <MapBounds draftCoordinates={draftCoordinates} zones={zones} />
          {zones.map((zone) =>
            getZonePolygons(zone.boundary).map((positions, index) => (
              <Polygon
                key={`${zone.id}:${index}`}
                positions={positions}
                pathOptions={{
                  color: zone.id === assetZoneId ? "#0f5132" : "#2f855a",
                  fillColor: zone.id === assetZoneId ? "#9ae6b4" : "#b9f5d0",
                  fillOpacity: zone.id === assetZoneId ? 0.32 : 0.14,
                  opacity: zone.id === assetZoneId ? 0.95 : 0.55,
                  weight: zone.id === assetZoneId ? 4 : 2
                }}
              >
                <Tooltip sticky>{zone.name}</Tooltip>
                <Popup>
                  <div className="map-popup">
                    <strong>{zone.name}</strong>
                    {zone.description ? <span>{zone.description}</span> : null}
                    <button type="button" className="map-popup-button" onClick={() => setAssetZoneId(zone.id)}>
                      Use this zone
                    </button>
                  </div>
                </Popup>
              </Polygon>
            ))
          )}
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

      <article className="panel details-panel">
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
          <button type="submit" disabled={isCreatingAsset}>
            {isCreatingAsset ? "Registering..." : "Register Asset"}
          </button>
        </form>
      </article>
    </section>
  );
};
