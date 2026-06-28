import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import { StaffSearchSelect } from "../components/StaffSearchSelect";
import type { StaffSelectOption } from "../components/StaffSearchSelect";
import { validateRequiredText, type FieldErrors } from "../validation";

type Incident = {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  photoUrls: string[];
  assignedTo: { id: string; name: string; email: string } | null;
  asset: { id: string; commonName: string | null; species: string; healthStatus: string } | null;
  zone: { id: string; name: string } | null;
};

type GreenAsset = {
  id: string;
  commonName: string | null;
  species: string;
  healthStatus: string;
};

type Zone = {
  id: string;
  name: string;
};

type IncidentEditForm = {
  title: string;
  description: string;
  priority: string;
  assignedToId: string;
  assetId: string;
  zoneId: string;
  photoUrls: string;
};

type IncidentEditField = "title" | "description" | "photoUrls";

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const createIncidentEditForm = (incident: Incident): IncidentEditForm => ({
  title: incident.title,
  description: incident.description,
  priority: incident.priority,
  assignedToId: incident.assignedTo?.id ?? "",
  assetId: incident.asset?.id ?? "",
  zoneId: incident.zone?.id ?? "",
  photoUrls: incident.photoUrls.join("\n")
});

export const IncidentTriageEditPage = () => {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [assets, setAssets] = useState<GreenAsset[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffSelectOption[]>([]);
  const [editForm, setEditForm] = useState<IncidentEditForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<IncidentEditField>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!incidentId || !token) {
      setError("Incident id is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    Promise.all([
      apiRequest<Incident>(`/incidents/${incidentId}`, { token }),
      apiRequest<GreenAsset[]>("/assets"),
      apiRequest<Zone[]>("/zones"),
      apiRequest<StaffSelectOption[]>("/users/staff", { token })
    ])
      .then(([incidentResponse, assetsResponse, zonesResponse, staffResponse]) => {
        setIncident(incidentResponse);
        setEditForm(createIncidentEditForm(incidentResponse));
        setAssets(assetsResponse);
        setZones(zonesResponse);
        setStaffUsers(staffResponse);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load triage editor.");
      })
      .finally(() => setIsLoading(false));
  }, [incidentId, token]);

  const updateEditForm = (patch: Partial<IncidentEditForm>) => {
    setEditForm((current) => (current ? { ...current, ...patch } : current));
  };

  const saveIncident = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!incident || !token || !editForm) {
      return;
    }

    setError(null);
    setFieldErrors({});

    const photoUrls = editForm.photoUrls
      .split("\n")
      .map((photoUrl) => photoUrl.trim())
      .filter(Boolean);
    const nextFieldErrors: FieldErrors<IncidentEditField> = {};
    const titleError = validateRequiredText(editForm.title, "Title", 3);
    const descriptionError = validateRequiredText(editForm.description, "Description", 10);
    const invalidPhotoUrl = photoUrls.find((photoUrl) => {
      try {
        new URL(photoUrl);
        return false;
      } catch {
        return true;
      }
    });

    if (titleError) {
      nextFieldErrors.title = titleError;
    }

    if (descriptionError) {
      nextFieldErrors.description = descriptionError;
    }

    if (invalidPhotoUrl) {
      nextFieldErrors.photoUrls = "Every photo URL must be a valid URL.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Fix the highlighted incident fields before saving.");
      return;
    }

    setIsSaving(true);

    try {
      const updatedIncident = await apiRequest<Incident>(`/incidents/${incident.id}`, {
        method: "PUT",
        token,
        body: {
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          priority: editForm.priority,
          assignedToId: editForm.assignedToId || null,
          assetId: editForm.assetId || null,
          zoneId: editForm.zoneId || null,
          photoUrls
        }
      });

      navigate(`/incidents/${updatedIncident.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not update incident details.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page narrow-edit">
        <h1>Edit Triage</h1>
        <p>Loading triage editor...</p>
      </section>
    );
  }

  if (!incident || !editForm) {
    return (
      <section className="page narrow">
        <h1>Edit Triage</h1>
        <p className="form-error">{error ?? "Incident not found."}</p>
        <Link className="text-link" to="/incidents">
          Back to incidents
        </Link>
      </section>
    );
  }

  return (
    <section className="page narrow-edit">
      <div className="details-header">
        <div>
          <p className="eyebrow">Triage editor</p>
          <h1>{incident.title}</h1>
          <p>Refine the report, priority, evidence links, and operational context.</p>
        </div>
        <Link to={`/incidents/${incident.id}`}>Back to incident</Link>
      </div>

      <article className="panel details-panel">
        <form className="inline-form asset-form" onSubmit={(event) => void saveIncident(event)} noValidate>
          <div className="form-grid">
            <label>
              Priority
              <select value={editForm.priority} onChange={(event) => updateEditForm({ priority: event.target.value })}>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Linked asset
              <select value={editForm.assetId} onChange={(event) => updateEditForm({ assetId: event.target.value })}>
                <option value="">Unlinked</option>
                {incident.asset && !assets.some((asset) => asset.id === incident.asset?.id) ? (
                  <option value={incident.asset.id}>{incident.asset.commonName ?? incident.asset.species}</option>
                ) : null}
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.commonName ?? asset.species}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Zone
              <select value={editForm.zoneId} onChange={(event) => updateEditForm({ zoneId: event.target.value })}>
                <option value="">Unassigned</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assigned to
              <StaffSearchSelect
                value={editForm.assignedToId}
                onChange={(assignedToId) => updateEditForm({ assignedToId })}
                staffUsers={staffUsers}
                placeholder="Unassigned"
              />
            </label>
            <label>
              Title
              <input
                aria-invalid={Boolean(fieldErrors.title)}
                value={editForm.title}
                onChange={(event) => updateEditForm({ title: event.target.value })}
                minLength={3}
                maxLength={160}
                required
              />
              {fieldErrors.title ? <span className="field-error">{fieldErrors.title}</span> : null}
            </label>
          </div>
          <label>
            Description
            <textarea
              aria-invalid={Boolean(fieldErrors.description)}
              value={editForm.description}
              onChange={(event) => updateEditForm({ description: event.target.value })}
              minLength={10}
              maxLength={2000}
              required
            />
            {fieldErrors.description ? <span className="field-error">{fieldErrors.description}</span> : null}
          </label>
          <label>
            Photo URLs
            <textarea
              aria-invalid={Boolean(fieldErrors.photoUrls)}
              value={editForm.photoUrls}
              onChange={(event) => updateEditForm({ photoUrls: event.target.value })}
              placeholder="https://example.com/photo.jpg"
            />
            {fieldErrors.photoUrls ? <span className="field-error">{fieldErrors.photoUrls}</span> : null}
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="button-row">
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Incident"}
            </button>
            <button className="muted-button" type="button" onClick={() => navigate(`/incidents/${incident.id}`)}>
              Cancel
            </button>
          </div>
        </form>
      </article>
    </section>
  );
};
