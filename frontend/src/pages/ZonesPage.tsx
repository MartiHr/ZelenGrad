import { useEffect, useState, type FormEvent } from "react";
import L from "leaflet";
import { Link } from "react-router";
import { CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import { StaffSearchSelect } from "../components/StaffSearchSelect";
import { createGeoJsonPolygon, getZonePolygons, type LatLngPair } from "../map/zoneBoundaries";
import { validateRequiredText, type FieldErrors } from "../validation";

type Zone = {
  id: string;
  name: string;
  description: string | null;
  boundary: unknown;
  createdAt: string;
  assignments: Array<{
    id: string;
    assignedAt: string;
    employee: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }>;
  _count: {
    assets: number;
    tasks: number;
    incidents: number;
    assignments: number;
  };
};

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type ZoneCreateField = "name" | "boundary";

type BoundaryMapProps = {
  zones: Zone[];
  draftPoints: LatLngPair[];
  onAddPoint: (point: LatLngPair) => void;
};

const defaultCenter: LatLngPair = [42.6977, 23.3219];

const BoundaryClickHandler = ({ onAddPoint }: { onAddPoint: (point: LatLngPair) => void }) => {
  useMapEvents({
    click: (event) => {
      onAddPoint([Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6))]);
    }
  });

  return null;
};

const BoundaryMapBounds = ({ zones, draftPoints }: { zones: Zone[]; draftPoints: LatLngPair[] }) => {
  const map = useMap();

  useEffect(() => {
    const zonePoints = zones.flatMap((zone) => getZonePolygons(zone.boundary).flat());
    const allPoints = [...zonePoints, ...draftPoints];

    if (allPoints.length >= 2) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [36, 36], maxZoom: 15 });
      return;
    }

    map.setView(defaultCenter, 12);
  }, [draftPoints, map, zones]);

  return null;
};

const BoundaryMap = ({ zones, draftPoints, onAddPoint }: BoundaryMapProps) => (
  <div className="zone-boundary-map-panel">
    <MapContainer center={defaultCenter} zoom={12} scrollWheelZoom className="zone-boundary-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <BoundaryClickHandler onAddPoint={onAddPoint} />
      <BoundaryMapBounds zones={zones} draftPoints={draftPoints} />
      {zones.map((zone) =>
        getZonePolygons(zone.boundary).map((positions, index) => (
          <Polygon
            key={`${zone.id}:${index}`}
            positions={positions}
            pathOptions={{
              color: "#2f855a",
              fillColor: "#b9f5d0",
              fillOpacity: 0.16,
              opacity: 0.65,
              weight: 2
            }}
          >
            <Tooltip sticky>{zone.name}</Tooltip>
            <Popup>
              <div className="map-popup">
                <strong>{zone.name}</strong>
                {zone.description ? <span>{zone.description}</span> : null}
              </div>
            </Popup>
          </Polygon>
        ))
      )}
      {draftPoints.length >= 2 ? (
        <Polyline positions={draftPoints} pathOptions={{ color: "#0f5132", dashArray: "8 6", weight: 3 }} />
      ) : null}
      {draftPoints.length >= 3 ? (
        <Polygon
          positions={draftPoints}
          pathOptions={{ color: "#0f5132", fillColor: "#9ae6b4", fillOpacity: 0.28, weight: 3 }}
        />
      ) : null}
      {draftPoints.map((point, index) => (
        <CircleMarker
          key={`${point[0]}:${point[1]}:${index}`}
          center={point}
          radius={6}
          pathOptions={{ color: "#ffffff", fillColor: "#0f5132", fillOpacity: 1, weight: 2 }}
        >
          <Tooltip>{index + 1}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  </div>
);

export const ZonesPage = () => {
  const { hasRole, token } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [boundaryJson, setBoundaryJson] = useState("");
  const [boundaryPoints, setBoundaryPoints] = useState<LatLngPair[]>([]);
  const [assignmentByZone, setAssignmentByZone] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<FieldErrors<ZoneCreateField>>({});
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingAssignment, setUpdatingAssignment] = useState<string | null>(null);
  const canManageZones = hasRole("MANAGER", "ADMIN");

  const loadZones = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setZones(await apiRequest<Zone[]>(canManageZones ? "/zones/management" : "/zones/me", { token }));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not load zones.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadZones();
  }, [canManageZones, token]);

  useEffect(() => {
    if (!token || !canManageZones) {
      setStaffUsers([]);
      return;
    }

    apiRequest<StaffUser[]>("/users/staff", { token })
      .then(setStaffUsers)
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load staff users.");
      });
  }, [canManageZones, token]);

  const createZone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setCreateError("Please log in before creating a zone.");
      return;
    }

    const nextFieldErrors: FieldErrors<ZoneCreateField> = {};
    const nameError = validateRequiredText(name, "Name", 2);
    let boundary: unknown;

    if (nameError) {
      nextFieldErrors.name = nameError;
    }

    if (boundaryJson.trim()) {
      try {
        boundary = JSON.parse(boundaryJson);
      } catch {
        nextFieldErrors.boundary = "Boundary must be valid GeoJSON.";
      }
    } else if (boundaryPoints.length > 0 && boundaryPoints.length < 3) {
      nextFieldErrors.boundary = "Click at least three map points to create a boundary.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setCreateFieldErrors(nextFieldErrors);
      setCreateError("Fix the highlighted zone fields before creating.");
      setCreateSuccess(null);
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateFieldErrors({});
    setCreateSuccess(null);

    try {
      const zone = await apiRequest<Zone>("/zones", {
        method: "POST",
        token,
        body: {
          name,
          description: description.trim() || undefined,
          boundary
        }
      });

      setZones((current) => [...current, zone].sort((left, right) => left.name.localeCompare(right.name)));
      setName("");
      setDescription("");
      setBoundaryJson("");
      setBoundaryPoints([]);
      setCreateSuccess(`Created ${zone.name}.`);
    } catch (caughtError) {
      setCreateError(caughtError instanceof SyntaxError ? "Boundary must be valid JSON." : caughtError instanceof ApiError ? caughtError.message : "Could not create zone.");
    } finally {
      setIsCreating(false);
    }
  };

  const addBoundaryPoint = (point: LatLngPair) => {
    setBoundaryPoints((current) => {
      const next = [...current, point];
      setBoundaryJson(next.length >= 3 ? JSON.stringify(createGeoJsonPolygon(next), null, 2) : "");
      return next;
    });
  };

  const undoBoundaryPoint = () => {
    setBoundaryPoints((current) => {
      const next = current.slice(0, -1);
      setBoundaryJson(next.length >= 3 ? JSON.stringify(createGeoJsonPolygon(next), null, 2) : "");
      return next;
    });
  };

  const clearBoundaryPoints = () => {
    setBoundaryPoints([]);
    setBoundaryJson("");
  };

  const replaceZone = (zone: Zone) => {
    setZones((current) => current.map((currentZone) => (currentZone.id === zone.id ? zone : currentZone)));
  };

  const assignEmployee = async (zone: Zone) => {
    if (!token) {
      setAssignmentError("Please log in before assigning staff.");
      return;
    }

    const employeeId = assignmentByZone[zone.id];

    if (!employeeId) {
      setAssignmentError("Choose a staff member first.");
      return;
    }

    setUpdatingAssignment(`${zone.id}:assign`);
    setAssignmentError(null);
    setAssignmentSuccess(null);

    try {
      const updatedZone = await apiRequest<Zone>(`/zones/${zone.id}/assignments`, {
        method: "POST",
        token,
        body: { employeeId }
      });

      replaceZone(updatedZone);
      setAssignmentByZone((current) => ({ ...current, [zone.id]: "" }));
      setAssignmentSuccess(`Updated assignments for ${updatedZone.name}.`);
    } catch (caughtError) {
      setAssignmentError(caughtError instanceof ApiError ? caughtError.message : "Could not assign staff user.");
    } finally {
      setUpdatingAssignment(null);
    }
  };

  const removeEmployee = async (zone: Zone, employeeId: string) => {
    if (!token) {
      setAssignmentError("Please log in before removing staff.");
      return;
    }

    setUpdatingAssignment(`${zone.id}:${employeeId}`);
    setAssignmentError(null);
    setAssignmentSuccess(null);

    try {
      const updatedZone = await apiRequest<Zone>(`/zones/${zone.id}/assignments/${employeeId}`, {
        method: "DELETE",
        token
      });

      replaceZone(updatedZone);
      setAssignmentSuccess(`Updated assignments for ${updatedZone.name}.`);
    } catch (caughtError) {
      setAssignmentError(caughtError instanceof ApiError ? caughtError.message : "Could not remove staff user.");
    } finally {
      setUpdatingAssignment(null);
    }
  };

  return (
    <section className="page">
      <h1>{canManageZones ? "Zones Management" : "My Zones"}</h1>
      <p>
        {canManageZones
          ? "Manage municipal areas used to organize green assets, incidents, and maintenance work."
          : "Review the zones assigned to you and jump into the related work queues."}
      </p>

      {!canManageZones && zones.length ? (
        <div className="worklist-summary">
          <span>{zones.length} assigned zones</span>
          <span>{zones.reduce((total, zone) => total + zone._count.assets, 0)} assets</span>
          <span>{zones.reduce((total, zone) => total + zone._count.tasks, 0)} tasks</span>
          <span>{zones.reduce((total, zone) => total + zone._count.incidents, 0)} incidents</span>
        </div>
      ) : null}

      {canManageZones ? (
        <article className="panel details-panel">
          <h2>Create Zone</h2>
        <form className="inline-form" onSubmit={(event) => void createZone(event)} noValidate>
          <div className="form-grid">
            <label>
              Name
              <input
                aria-invalid={Boolean(createFieldErrors.name)}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setCreateFieldErrors((current) => ({ ...current, name: undefined }));
                }}
                maxLength={120}
                minLength={2}
                required
                placeholder="University District"
              />
              {createFieldErrors.name ? <span className="field-error">{createFieldErrors.name}</span> : null}
            </label>
          </div>
          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              placeholder="Short operational note for this zone."
            />
          </label>
          <label>
            Boundary JSON
            <textarea
              aria-invalid={Boolean(createFieldErrors.boundary)}
              value={boundaryJson}
              onChange={(event) => {
                setBoundaryJson(event.target.value);
                setCreateFieldErrors((current) => ({ ...current, boundary: undefined }));
              }}
              placeholder='{"type":"Polygon","coordinates":[[[23.31,42.70],[23.33,42.70],[23.33,42.69],[23.31,42.69],[23.31,42.70]]]}'
            />
            {createFieldErrors.boundary ? <span className="field-error">{createFieldErrors.boundary}</span> : null}
          </label>
          <div className="boundary-editor">
            <div className="boundary-editor-header">
              <span>Boundary Map</span>
              <div className="button-row">
                <button type="button" className="muted-button" disabled={boundaryPoints.length === 0} onClick={undoBoundaryPoint}>
                  Undo Point
                </button>
                <button type="button" className="muted-button" disabled={boundaryPoints.length === 0} onClick={clearBoundaryPoints}>
                  Clear
                </button>
              </div>
            </div>
            <BoundaryMap zones={zones} draftPoints={boundaryPoints} onAddPoint={addBoundaryPoint} />
            <p className="muted-text">
              Click the map to add at least three points. The boundary JSON updates automatically.
            </p>
          </div>
          {createError ? <p className="form-error">{createError}</p> : null}
          {createSuccess ? <p className="form-success">{createSuccess}</p> : null}
          <button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Zone"}
          </button>
        </form>
        </article>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {assignmentError ? <p className="form-error">{assignmentError}</p> : null}
      {assignmentSuccess ? <p className="form-success">{assignmentSuccess}</p> : null}

      <article className="panel details-panel">
        <h2>Zone Boundaries</h2>
        <BoundaryMap zones={zones} draftPoints={[]} onAddPoint={() => undefined} />
      </article>

      <div className="asset-grid">
        {isLoading ? <p>Loading zones...</p> : null}
        {!isLoading && zones.length === 0 ? (
          <p>{canManageZones ? "No zones have been created yet." : "You are not assigned to any zones yet."}</p>
        ) : null}
        {zones.map((zone) => (
          <article className="asset-card" key={zone.id}>
            <div>
              <p className="eyebrow">Zone</p>
              <h2>{zone.name}</h2>
            </div>
            <p>{zone.description ?? "No description has been added for this zone yet."}</p>
            <dl>
              <div>
                <dt>Assets</dt>
                <dd>{zone._count.assets}</dd>
              </div>
              <div>
                <dt>Tasks</dt>
                <dd>{zone._count.tasks}</dd>
              </div>
              <div>
                <dt>Incidents</dt>
                <dd>{zone._count.incidents}</dd>
              </div>
              <div>
                <dt>Assignments</dt>
                <dd>{zone._count.assignments}</dd>
              </div>
            </dl>
            {canManageZones ? (
              <div className="assignment-panel">
              <h3>Assigned Staff</h3>
              {zone.assignments.length ? (
                <ul className="assignment-list">
                  {zone.assignments.map((assignment) => (
                    <li key={assignment.id}>
                      <span>
                        <strong>{assignment.employee.name}</strong>
                        <small>
                          {assignment.employee.role} | {assignment.employee.email}
                        </small>
                      </span>
                      <button
                        type="button"
                        disabled={updatingAssignment === `${zone.id}:${assignment.employee.id}`}
                        onClick={() => void removeEmployee(zone, assignment.employee.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No staff are assigned to this zone yet.</p>
              )}
              <div className="inline-assignment-form">
                <StaffSearchSelect
                  value={assignmentByZone[zone.id] ?? ""}
                  onChange={(employeeId) =>
                    setAssignmentByZone((current) => ({ ...current, [zone.id]: employeeId }))
                  }
                  staffUsers={staffUsers}
                  placeholder="Choose staff"
                />
                <button
                  type="button"
                  disabled={updatingAssignment === `${zone.id}:assign`}
                  onClick={() => void assignEmployee(zone)}
                >
                  Assign
                </button>
              </div>
              </div>
            ) : (
              <div className="assignment-panel">
                <h3>Zone Work</h3>
                <p className="muted-text">Open filtered views for this assigned zone.</p>
                <div className="button-row">
                  <Link to={`/worklist?zoneId=${zone.id}`}>Tasks</Link>
                  <Link to={`/incidents?zoneId=${zone.id}`}>Incidents</Link>
                  <Link to={`/map?zoneId=${zone.id}`}>Assets</Link>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};
