import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import { StaffSearchSelect } from "../components/StaffSearchSelect";
import { validateDateOrder, validateRequiredText, type FieldErrors } from "../validation";

type Asset = {
  id: string;
  commonName: string | null;
  species: string;
  zone: { id: string; name: string } | null;
};

type MaintenanceTask = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
};

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type MaintenanceField = "title" | "dueAt";

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const maintenanceTypes = ["WATERING", "PRUNING", "INSPECTION", "TREATMENT", "CLEANUP", "REMOVAL", "OTHER"];

export const AssetMaintenanceSchedulePage = () => {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [maintenanceType, setMaintenanceType] = useState("INSPECTION");
  const [maintenancePriority, setMaintenancePriority] = useState("MEDIUM");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceDescription, setMaintenanceDescription] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<MaintenanceField>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    if (!assetId || !token) {
      setError("Asset id is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    Promise.all([apiRequest<Asset>(`/assets/${assetId}`), apiRequest<StaffUser[]>("/users/staff", { token })])
      .then(([assetResponse, staffResponse]) => {
        setAsset(assetResponse);
        setStaffUsers(staffResponse);
      })
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load maintenance scheduler.");
      })
      .finally(() => setIsLoading(false));
  }, [assetId, token]);

  useEffect(() => {
    if (asset && !maintenanceTitle.trim()) {
      setMaintenanceTitle(`Inspect ${asset.commonName ?? asset.species}`);
    }
  }, [asset, maintenanceTitle]);

  const scheduleMaintenance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!asset || !token) {
      setError("Please log in before scheduling maintenance.");
      return;
    }

    const nextFieldErrors: FieldErrors<MaintenanceField> = {};
    const titleError = validateRequiredText(maintenanceTitle, "Title", 3);
    const dateOrderError = validateDateOrder(scheduledFor, dueAt, "scheduled date", "Due date");

    if (titleError) {
      nextFieldErrors.title = titleError;
    }

    if (dateOrderError) {
      nextFieldErrors.dueAt = dateOrderError;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Fix the highlighted maintenance fields before scheduling.");
      return;
    }

    setIsScheduling(true);
    setError(null);
    setFieldErrors({});

    try {
      const task = await apiRequest<MaintenanceTask>("/maintenance", {
        method: "POST",
        token,
        body: {
          title: maintenanceTitle.trim(),
          description: maintenanceDescription.trim() || undefined,
          type: maintenanceType,
          priority: maintenancePriority,
          scheduledFor: scheduledFor || undefined,
          dueAt: dueAt || undefined,
          assetId: asset.id,
          zoneId: asset.zone?.id,
          assignedToId: assignedToId || undefined
        }
      });

      navigate(`/worklist/${task.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not schedule maintenance task.");
    } finally {
      setIsScheduling(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page narrow-edit">
        <h1>Schedule Maintenance</h1>
        <p>Loading scheduler...</p>
      </section>
    );
  }

  if (!asset) {
    return (
      <section className="page narrow">
        <h1>Schedule Maintenance</h1>
        <p className="form-error">{error ?? "Asset not found."}</p>
        <Link className="text-link" to="/map">
          Back to map
        </Link>
      </section>
    );
  }

  return (
    <section className="page narrow-edit">
      <div className="details-header">
        <div>
          <p className="eyebrow">Asset maintenance</p>
          <h1>Schedule Maintenance</h1>
          <p>
            Create field work for {asset.commonName ?? asset.species}
            {asset.zone ? ` in ${asset.zone.name}` : ""}.
          </p>
        </div>
        <Link to={`/assets/${asset.id}`}>Back to asset</Link>
      </div>

      <article className="panel details-panel">
        <form className="inline-form asset-form" onSubmit={(event) => void scheduleMaintenance(event)} noValidate>
          <div className="form-grid">
            <label>
              Task type
              <select value={maintenanceType} onChange={(event) => setMaintenanceType(event.target.value)}>
                {maintenanceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select value={maintenancePriority} onChange={(event) => setMaintenancePriority(event.target.value)}>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                aria-invalid={Boolean(fieldErrors.title)}
                value={maintenanceTitle}
                onChange={(event) => setMaintenanceTitle(event.target.value)}
                minLength={3}
                maxLength={160}
                required
              />
              {fieldErrors.title ? <span className="field-error">{fieldErrors.title}</span> : null}
            </label>
            <label>
              Assignee
              <StaffSearchSelect
                value={assignedToId}
                onChange={setAssignedToId}
                staffUsers={staffUsers}
                placeholder="Unassigned"
              />
            </label>
            <label>
              Scheduled for
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
            </label>
            <label>
              Due at
              <input
                aria-invalid={Boolean(fieldErrors.dueAt)}
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
              {fieldErrors.dueAt ? <span className="field-error">{fieldErrors.dueAt}</span> : null}
            </label>
          </div>
          <label>
            Description
            <textarea
              value={maintenanceDescription}
              onChange={(event) => setMaintenanceDescription(event.target.value)}
              maxLength={1000}
              placeholder="Describe the planned work for the field team."
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="button-row">
            <button type="submit" disabled={isScheduling}>
              {isScheduling ? "Scheduling..." : "Schedule Maintenance"}
            </button>
            <button className="muted-button" type="button" onClick={() => navigate(`/assets/${asset.id}`)}>
              Cancel
            </button>
          </div>
        </form>
      </article>
    </section>
  );
};
