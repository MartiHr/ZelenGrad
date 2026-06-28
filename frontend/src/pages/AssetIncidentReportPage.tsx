import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import { validateRequiredText, type FieldErrors } from "../validation";

type Asset = {
  id: string;
  commonName: string | null;
  species: string;
  latitude: string;
  longitude: string;
  zone: { id: string; name: string } | null;
};

type CreatedIncident = {
  id: string;
  type: string;
  priority: string;
  title: string;
  status: string;
};

type ReportField = "title" | "description";

const incidentTypes = ["DRY_TREE", "VANDALISM", "DISEASE", "FALLEN_BRANCH", "WASTE", "OTHER"];
const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const AssetIncidentReportPage = () => {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const { refreshUser, token } = useAuth();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [reportType, setReportType] = useState("DRY_TREE");
  const [reportPriority, setReportPriority] = useState("MEDIUM");
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<ReportField>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!assetId) {
      setError("Asset id is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    apiRequest<Asset>(`/assets/${assetId}`)
      .then(setAsset)
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load asset.");
      })
      .finally(() => setIsLoading(false));
  }, [assetId]);

  const submitIncidentReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!asset || !token) {
      setError("Please log in before reporting an incident.");
      return;
    }

    const nextFieldErrors: FieldErrors<ReportField> = {};
    const titleError = validateRequiredText(reportTitle, "Title", 3);
    const descriptionError = validateRequiredText(reportDescription, "Description", 10);

    if (titleError) {
      nextFieldErrors.title = titleError;
    }

    if (descriptionError) {
      nextFieldErrors.description = descriptionError;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Fix the highlighted incident fields before submitting.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const incident = await apiRequest<CreatedIncident>("/incidents", {
        method: "POST",
        token,
        body: {
          type: reportType,
          priority: reportPriority,
          title: reportTitle.trim(),
          description: reportDescription.trim(),
          assetId: asset.id,
          zoneId: asset.zone?.id,
          latitude: asset.latitude,
          longitude: asset.longitude
        }
      });

      await refreshUser();
      navigate(`/incidents/${incident.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not submit incident report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="page narrow-edit">
        <h1>Report Incident</h1>
        <p>Loading asset...</p>
      </section>
    );
  }

  if (!asset) {
    return (
      <section className="page narrow">
        <h1>Report Incident</h1>
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
          <p className="eyebrow">Asset incident</p>
          <h1>Report Incident</h1>
          <p>
            Submit a field observation for {asset.commonName ?? asset.species}
            {asset.zone ? ` in ${asset.zone.name}` : ""}.
          </p>
        </div>
        <Link to={`/assets/${asset.id}`}>Back to asset</Link>
      </div>

      <article className="panel details-panel">
        <form className="inline-form asset-form" onSubmit={(event) => void submitIncidentReport(event)} noValidate>
          <div className="form-grid">
            <label>
              Incident type
              <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
                {incidentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select value={reportPriority} onChange={(event) => setReportPriority(event.target.value)}>
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
                value={reportTitle}
                onChange={(event) => setReportTitle(event.target.value)}
                minLength={3}
                maxLength={160}
                required
                placeholder="Dry branches near sidewalk"
              />
              {fieldErrors.title ? <span className="field-error">{fieldErrors.title}</span> : null}
            </label>
          </div>
          <label>
            Description
            <textarea
              aria-invalid={Boolean(fieldErrors.description)}
              value={reportDescription}
              onChange={(event) => setReportDescription(event.target.value)}
              minLength={10}
              maxLength={2000}
              required
              placeholder="Describe what you noticed and where it is visible."
            />
            {fieldErrors.description ? <span className="field-error">{fieldErrors.description}</span> : null}
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <div className="button-row">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Report Incident"}
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
