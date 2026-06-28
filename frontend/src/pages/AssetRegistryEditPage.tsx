import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import { validateCoordinate, validateRequiredText, type FieldErrors } from "../validation";

type Asset = {
  id: string;
  type: string;
  commonName: string | null;
  species: string;
  description: string | null;
  latitude: string;
  longitude: string;
  plantedAt: string | null;
  healthStatus: string;
  lifecycleStatus: string;
  metadata: { photoUrl?: string } | null;
  zone: { id: string; name: string } | null;
};

type Zone = {
  id: string;
  name: string;
};

type AssetFormState = {
  type: string;
  commonName: string;
  species: string;
  description: string;
  latitude: string;
  longitude: string;
  plantedAt: string;
  healthStatus: string;
  lifecycleStatus: string;
  zoneId: string;
};

type AssetRegistryField = "species" | "latitude" | "longitude" | "plantedAt";

const assetTypes = ["TREE", "PARK", "SHRUB", "GARDEN"];
const assetHealthStatuses = ["HEALTHY", "NEEDS_ATTENTION", "DRY", "DISEASED", "DAMAGED", "REMOVED"];
const assetLifecycleStatuses = ["ACTIVE", "UNDER_MAINTENANCE", "ARCHIVED"];

const formatDateInput = (value: string | null) => {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
};

const createAssetFormState = (asset: Asset): AssetFormState => ({
  type: asset.type,
  commonName: asset.commonName ?? "",
  species: asset.species,
  description: asset.description ?? "",
  latitude: asset.latitude,
  longitude: asset.longitude,
  plantedAt: formatDateInput(asset.plantedAt),
  healthStatus: asset.healthStatus,
  lifecycleStatus: asset.lifecycleStatus,
  zoneId: asset.zone?.id ?? ""
});

export const AssetRegistryEditPage = () => {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [assetForm, setAssetForm] = useState<AssetFormState | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<AssetRegistryField>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    if (!assetId) {
      setError("Asset id is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    Promise.all([apiRequest<Asset>(`/assets/${assetId}`), apiRequest<Zone[]>("/zones")])
      .then(([assetResponse, zonesResponse]) => {
        setAsset(assetResponse);
        setAssetForm(createAssetFormState(assetResponse));
        setZones(zonesResponse);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load asset registry.");
      })
      .finally(() => setIsLoading(false));
  }, [assetId]);

  const updateAssetForm = (patch: Partial<AssetFormState>) => {
    setAssetForm((current) => (current ? { ...current, ...patch } : current));
  };

  const updateAssetRegistry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token || !asset || !assetForm) {
      setError("Please log in before updating this asset.");
      return;
    }

    const nextFieldErrors: FieldErrors<AssetRegistryField> = {};
    const speciesError = validateRequiredText(assetForm.species, "Species");
    const latitudeError = validateCoordinate(assetForm.latitude, "Latitude");
    const longitudeError = validateCoordinate(assetForm.longitude, "Longitude");

    if (speciesError) {
      nextFieldErrors.species = speciesError;
    }

    if (latitudeError) {
      nextFieldErrors.latitude = latitudeError;
    }

    if (longitudeError) {
      nextFieldErrors.longitude = longitudeError;
    }

    if (assetForm.plantedAt && new Date(assetForm.plantedAt).getTime() > Date.now()) {
      nextFieldErrors.plantedAt = "Planted date cannot be in the future.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Fix the highlighted registry fields before saving.");
      setSuccess(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    setFieldErrors({});
    setSuccess(null);

    try {
      const updatedAsset = await apiRequest<Asset>(`/assets/${asset.id}`, {
        method: "PUT",
        token,
        body: {
          type: assetForm.type,
          commonName: assetForm.commonName.trim() || undefined,
          species: assetForm.species.trim(),
          description: assetForm.description.trim() || undefined,
          latitude: assetForm.latitude,
          longitude: assetForm.longitude,
          plantedAt: assetForm.plantedAt || undefined,
          healthStatus: assetForm.healthStatus,
          lifecycleStatus: assetForm.lifecycleStatus,
          zoneId: assetForm.zoneId || null
        }
      });

      setAsset(updatedAsset);
      setAssetForm(createAssetFormState(updatedAsset));
      setSuccess("Asset registry saved.");
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not update asset.");
    } finally {
      setIsSaving(false);
    }
  };

  const archiveAsset = async () => {
    if (!token || !asset) {
      setError("Please log in before archiving this asset.");
      return;
    }

    const shouldArchive = window.confirm("Archive this asset? It will no longer appear on the public green map.");

    if (!shouldArchive) {
      return;
    }

    setIsArchiving(true);
    setError(null);
    setSuccess(null);

    try {
      const archivedAsset = await apiRequest<Asset>(`/assets/${asset.id}`, {
        method: "DELETE",
        token
      });

      setAsset(archivedAsset);
      setAssetForm(createAssetFormState(archivedAsset));
      setSuccess("Asset archived.");
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not archive asset.");
    } finally {
      setIsArchiving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page narrow">
        <h1>Edit Registry</h1>
        <p>Loading asset registry...</p>
      </section>
    );
  }

  if (!asset || !assetForm) {
    return (
      <section className="page narrow">
        <h1>Edit Registry</h1>
        <p className="form-error">{error ?? "Asset not found."}</p>
        <Link to="/map">Back to map</Link>
      </section>
    );
  }

  return (
    <section className="page narrow-edit">
      <div className="details-header">
        <div>
          <p className="eyebrow">Registry editor</p>
          <h1>{asset.commonName ?? asset.species}</h1>
          <p>Edit the asset identity, location, lifecycle state, and zone assignment.</p>
        </div>
        <Link to={`/assets/${asset.id}`}>Back to details</Link>
      </div>

      <article className="panel details-panel">
        <form className="inline-form asset-form" onSubmit={(event) => void updateAssetRegistry(event)} noValidate>
          <div className="form-grid">
            <label>
              Type
              <select value={assetForm.type} onChange={(event) => updateAssetForm({ type: event.target.value })}>
                {assetTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Health
              <select
                value={assetForm.healthStatus}
                onChange={(event) => updateAssetForm({ healthStatus: event.target.value })}
              >
                {assetHealthStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lifecycle
              <select
                value={assetForm.lifecycleStatus}
                onChange={(event) => updateAssetForm({ lifecycleStatus: event.target.value })}
              >
                {assetLifecycleStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Common name
              <input
                value={assetForm.commonName}
                onChange={(event) => updateAssetForm({ commonName: event.target.value })}
                maxLength={120}
              />
            </label>
            <label>
              Species
              <input
                aria-invalid={Boolean(fieldErrors.species)}
                value={assetForm.species}
                onChange={(event) => updateAssetForm({ species: event.target.value })}
                maxLength={160}
                required
              />
              {fieldErrors.species ? <span className="field-error">{fieldErrors.species}</span> : null}
            </label>
            <label>
              Latitude
              <input
                aria-invalid={Boolean(fieldErrors.latitude)}
                value={assetForm.latitude}
                onChange={(event) => updateAssetForm({ latitude: event.target.value })}
                required
                step="0.000001"
                type="number"
              />
              {fieldErrors.latitude ? <span className="field-error">{fieldErrors.latitude}</span> : null}
            </label>
            <label>
              Longitude
              <input
                aria-invalid={Boolean(fieldErrors.longitude)}
                value={assetForm.longitude}
                onChange={(event) => updateAssetForm({ longitude: event.target.value })}
                required
                step="0.000001"
                type="number"
              />
              {fieldErrors.longitude ? <span className="field-error">{fieldErrors.longitude}</span> : null}
            </label>
            <label>
              Planted
              <input
                aria-invalid={Boolean(fieldErrors.plantedAt)}
                type="date"
                value={assetForm.plantedAt}
                onChange={(event) => updateAssetForm({ plantedAt: event.target.value })}
              />
              {fieldErrors.plantedAt ? <span className="field-error">{fieldErrors.plantedAt}</span> : null}
            </label>
            <label>
              Zone
              <select value={assetForm.zoneId} onChange={(event) => updateAssetForm({ zoneId: event.target.value })}>
                <option value="">Unassigned</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              value={assetForm.description}
              onChange={(event) => updateAssetForm({ description: event.target.value })}
              maxLength={1000}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {success ? <p className="form-success">{success}</p> : null}

          <div className="button-row">
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Registry"}
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={isArchiving}
              onClick={() => void archiveAsset()}
            >
              {isArchiving ? "Archiving..." : "Archive Asset"}
            </button>
            <button className="muted-button" type="button" onClick={() => navigate(`/assets/${asset.id}`)}>
              Done
            </button>
          </div>
        </form>
      </article>
    </section>
  );
};
