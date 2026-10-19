/** Valid WGS84 coordinates for map markers. */
export function isValidMapCoordinate(
  latitude: unknown,
  longitude: unknown
): latitude is number {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return false;
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

export function normalizeMapMarkers<
  T extends { latitude: number; longitude: number },
>(markers: T[]): T[] {
  return markers.filter((m) =>
    isValidMapCoordinate(m.latitude, m.longitude)
  );
}
