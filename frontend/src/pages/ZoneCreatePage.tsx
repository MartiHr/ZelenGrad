import { useEffect, useState, type FormEvent } from "react";
import L from "leaflet";
import { Link, useNavigate } from "react-router";
import { CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import { createGeoJsonPolygon, getZonePolygons, type LatLngPair } from "../map/zoneBoundaries";
import { validateRequiredText, type FieldErrors } from "../validation";

type Zone = {
  id: string;
  name: string;
  description: string | null;
  boundary: unknown;
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

const BoundaryMapBounds = ({ draftPoints }: { draftPoints: LatLngPair[] }) => {
  const map = useMap();

  useEffect(() => {
    if (draftPoints.length >= 2) {
      map.fitBounds(L.latLngBounds(draftPoints), { padding: [36, 36], maxZoom: 15 });
      return;
    }

    map.setView(defaultCenter, 12);
  }, [draftPoints, map]);

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
      <BoundaryMapBounds draftPoints={draftPoints} />
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

export const ZoneCreatePage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [boundaryJson, setBoundaryJson] = useState("");
  const [boundaryPoints, setBoundaryPoints] = useState<LatLngPair[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<ZoneCreateField>>({});
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    apiRequest<Zone[]>("/zones")
      .then(setZones)
      .catch(() => setZones([]));
  }, []);

  const createZone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setError("Please log in before creating a zone.");
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
      setFieldErrors(nextFieldErrors);
      setError("Fix the highlighted zone fields before creating.");
      return;
    }

    setIsCreating(true);
    setError(null);
    setFieldErrors({});

    try {
      await apiRequest<Zone>("/zones", {
        method: "POST",
        token,
        body: {
          name,
          description: description.trim() || undefined,
          boundary
        }
      });

      navigate("/zones");
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not create zone.");
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

  return (
    <section className="page narrow-edit">
      <div className="details-header">
        <div>
          <p className="eyebrow">Zone registry</p>
          <h1>Create Zone</h1>
          <p>Draw a boundary on the map or paste GeoJSON, then save the operational area.</p>
        </div>
        <Link to="/zones">Back to zones</Link>
      </div>

      <article className="panel details-panel">
        <form className="inline-form" onSubmit={(event) => void createZone(event)} noValidate>
          <div className="form-grid">
            <label>
              Name
              <input
                aria-invalid={Boolean(fieldErrors.name)}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setFieldErrors((current) => ({ ...current, name: undefined }));
                }}
                maxLength={120}
                minLength={2}
                required
                placeholder="University District"
              />
              {fieldErrors.name ? <span className="field-error">{fieldErrors.name}</span> : null}
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
              aria-invalid={Boolean(fieldErrors.boundary)}
              value={boundaryJson}
              onChange={(event) => {
                setBoundaryJson(event.target.value);
                setFieldErrors((current) => ({ ...current, boundary: undefined }));
              }}
              placeholder='{"type":"Polygon","coordinates":[[[23.31,42.70],[23.33,42.70],[23.33,42.69],[23.31,42.69],[23.31,42.70]]]}'
            />
            {fieldErrors.boundary ? <span className="field-error">{fieldErrors.boundary}</span> : null}
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
          {error ? <p className="form-error">{error}</p> : null}
          <div className="button-row">
            <button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Zone"}
            </button>
            <button className="muted-button" type="button" onClick={() => navigate("/zones")}>
              Cancel
            </button>
          </div>
        </form>
      </article>
    </section>
  );
};
