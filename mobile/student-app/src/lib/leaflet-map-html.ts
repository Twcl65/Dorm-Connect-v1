import type { MapMarkerData } from "@/components/property-map-marker";

const CIRCLE_SIZE = 52;
const LABEL_GAP = 6;
const ICON_WIDTH = 140;
const LABEL_BLOCK = 32;
const ICON_HEIGHT = LABEL_BLOCK + LABEL_GAP + CIRCLE_SIZE;

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(s: string): string {
  return s.replace(/[<>]/g, "");
}

function markerHtml(p: MapMarkerData, selected: boolean): string {
  const name = (p.name || "Dorm").trim();
  const label =
    name.length > 32 ? `${escapeText(name.slice(0, 30))}…` : escapeText(name);
  const titleAttr = escapeAttr(name);
  const url = p.coverImageUrl?.trim() ?? "";
  const safeUrl =
    url.startsWith("/uploads/") ||
    url.startsWith("https://") ||
    url.startsWith("http://")
      ? url.replace(/"/g, "")
      : "";
  const circleInner = safeUrl
    ? `<img src="${safeUrl}" alt="" />`
    : `<div class="dc-student-marker-fallback">${escapeText(name).slice(0, 3)}</div>`;
  const selectedClass = selected ? " dc-student-marker-selected" : "";

  return `<div class="dc-student-marker-wrap" title="${titleAttr}">
    <div class="dc-student-marker-label-above">${label}</div>
    <div class="dc-student-marker${selectedClass}">${circleInner}</div>
  </div>`;
}

const LEAFLET_CSS = `
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
  .leaflet-container { font-family: system-ui, sans-serif; }
  .dc-map-div-icon { background: transparent !important; border: none !important; }
  .dc-student-marker {
    width: 48px; height: 48px; border-radius: 9999px;
    border: 3px solid #22c55e; background: #fff;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    overflow: hidden; display: flex; align-items: center; justify-content: center;
  }
  .dc-student-marker-selected { border-color: #0ea5e9; border-width: 4px; }
  .dc-student-marker-wrap {
    display: flex; flex-direction: column; align-items: center;
    width: 140px; margin-left: -70px; pointer-events: auto; cursor: pointer;
  }
  .dc-student-marker-label-above {
    margin-bottom: 6px; max-width: 140px; padding: 6px 10px; border-radius: 6px;
    border: 1px solid #bbf7d0; background: #f0fdf4; color: #14532d;
    font-size: 12px; font-weight: 600; line-height: 1.2; text-align: center;
    word-break: break-word; box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }
  .dc-student-marker img {
    width: 100%; height: 100%; object-fit: cover; border-radius: 9999px;
  }
  .dc-student-marker-fallback {
    font-size: 10px; font-weight: 700; color: #15803d; text-align: center;
    line-height: 1.1; padding: 2px;
  }
`;

export function buildLeafletMapHtml(
  markers: MapMarkerData[],
  selectedId?: string | null
): string {
  const center =
    markers.length === 0
      ? { lat: 8.4542, lng: 124.6319 }
      : markers.reduce(
          (a, m) => ({ lat: a.lat + m.latitude, lng: a.lng + m.longitude }),
          { lat: 0, lng: 0 }
        );
  const centerLat =
    markers.length === 0 ? center.lat : center.lat / markers.length;
  const centerLng =
    markers.length === 0 ? center.lng : center.lng / markers.length;
  const zoom = markers.length === 1 ? 16 : 13;

  const markersJson = JSON.stringify(
    markers.map((m) => ({
      id: m.id,
      lat: m.latitude,
      lng: m.longitude,
      html: markerHtml(m, selectedId === m.id),
    }))
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>${LEAFLET_CSS}</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <script>
    const markers = ${markersJson};
    const map = L.map('map', { zoomControl: true }).setView([${centerLat}, ${centerLng}], ${zoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const iconW = ${ICON_WIDTH};
    const iconH = ${ICON_HEIGHT};
    const anchorY = ${LABEL_BLOCK + LABEL_GAP + CIRCLE_SIZE / 2};
    const layers = [];

    markers.forEach(function(m) {
      const icon = L.divIcon({
        className: 'dc-map-div-icon',
        html: m.html,
        iconSize: [iconW, iconH],
        iconAnchor: [iconW / 2, anchorY],
      });
      const layer = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
      layer.on('click', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker', id: m.id }));
        }
      });
      layers.push(layer);
    });

    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 16);
    } else if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map(function(m) { return [m.lat, m.lng]; }));
      map.fitBounds(bounds, { padding: [72, 72], maxZoom: 16 });
    }
  <\/script>
</body>
</html>`;
}
