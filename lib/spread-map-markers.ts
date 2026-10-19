/**
 * Spread map markers that are very close on the ground (e.g. two properties a
 * few meters apart) so each green pin stays visible and tappable. Uses
 * Haversine distance, not only identical rounded coordinates.
 */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function spreadOverlappingMarkers<
  T extends { id: string; latitude: number; longitude: number },
>(markers: T[], proximityMeters = 160): T[] {
  if (markers.length <= 1) return markers;
  const n = markers.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineMeters(
        markers[i].latitude,
        markers[i].longitude,
        markers[j].latitude,
        markers[j].longitude
      );
      if (d < proximityMeters) union(i, j);
    }
  }

  const clusters = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const arr = clusters.get(r) ?? [];
    arr.push(i);
    clusters.set(r, arr);
  }

  const result = markers.map((m) => ({ ...m }));

  for (const idxs of clusters.values()) {
    if (idxs.length < 2) continue;

    let sumLat = 0;
    let sumLng = 0;
    for (const i of idxs) {
      sumLat += markers[i].latitude;
      sumLng += markers[i].longitude;
    }
    const clat = sumLat / idxs.length;
    const clng = sumLng / idxs.length;
    const latRad = (clat * Math.PI) / 180;
    const ringMeters = Math.max(58, 42 * idxs.length);

    for (let k = 0; k < idxs.length; k++) {
      const i = idxs[k];
      const angle = (2 * Math.PI * k) / idxs.length;
      const dLat = (ringMeters / 111320) * Math.sin(angle);
      const dLng =
        (ringMeters / (111320 * Math.max(0.2, Math.cos(latRad)))) *
        Math.cos(angle);
      result[i] = {
        ...markers[i],
        latitude: clat + dLat,
        longitude: clng + dLng,
      };
    }
  }

  return result;
}
