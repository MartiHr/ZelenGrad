export type LatLngPair = [number, number];

const isCoordinatePair = (value: unknown): value is LatLngPair =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  typeof value[1] === "number" &&
  Number.isFinite(value[0]) &&
  Number.isFinite(value[1]);

const toLatLngPair = (value: unknown, coordinatesAreLngLat = false): LatLngPair | null => {
  if (isCoordinatePair(value)) {
    return coordinatesAreLngLat ? [value[1], value[0]] : [value[0], value[1]];
  }

  if (typeof value === "object" && value !== null && "lat" in value && "lng" in value) {
    const lat = Number((value as { lat: unknown }).lat);
    const lng = Number((value as { lng: unknown }).lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }

  if (typeof value === "object" && value !== null && "latitude" in value && "longitude" in value) {
    const lat = Number((value as { latitude: unknown }).latitude);
    const lng = Number((value as { longitude: unknown }).longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }

  return null;
};

const parseCoordinateRing = (ring: unknown, coordinatesAreLngLat = false) => {
  if (!Array.isArray(ring)) {
    return [];
  }

  return ring
    .map((coordinate) => toLatLngPair(coordinate, coordinatesAreLngLat))
    .filter((coordinate): coordinate is LatLngPair => coordinate !== null);
};

export const getZonePolygons = (boundary: unknown): LatLngPair[][] => {
  if (!boundary) {
    return [];
  }

  if (Array.isArray(boundary)) {
    const ring = parseCoordinateRing(boundary);
    return ring.length >= 3 ? [ring] : [];
  }

  if (typeof boundary !== "object") {
    return [];
  }

  const geoJson = boundary as { type?: unknown; coordinates?: unknown };

  if (geoJson.type === "Polygon" && Array.isArray(geoJson.coordinates)) {
    const ring = parseCoordinateRing(geoJson.coordinates[0], true);
    return ring.length >= 3 ? [ring] : [];
  }

  if (geoJson.type === "MultiPolygon" && Array.isArray(geoJson.coordinates)) {
    return geoJson.coordinates
      .map((polygon) => (Array.isArray(polygon) ? parseCoordinateRing(polygon[0], true) : []))
      .filter((ring) => ring.length >= 3);
  }

  if ("points" in geoJson) {
    const ring = parseCoordinateRing((geoJson as { points: unknown }).points);
    return ring.length >= 3 ? [ring] : [];
  }

  return [];
};

export const createGeoJsonPolygon = (points: LatLngPair[]) => ({
  type: "Polygon",
  coordinates: [[...points.map(([lat, lng]) => [lng, lat]), [points[0][1], points[0][0]]]]
});
