"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type StudentMapMarker = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  coverImageUrl?: string | null;
};

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markerIcon(p: StudentMapMarker): L.DivIcon {
  const url = p.coverImageUrl?.trim() ?? "";
  const safeUrl = url.startsWith("/uploads/") ? url.replace(/"/g, "") : "";
  const img = safeUrl
    ? `<img src="${safeUrl}" alt="" />`
    : `<div class="dc-student-marker-fallback">${escapeText(p.name).slice(0, 3)}</div>`;
  const titleAttr = escapeAttr(p.name);
  const html = `<div class="dc-student-marker" title="${titleAttr}">${img}</div>`;
  return L.divIcon({
    className: "dc-map-div-icon",
    html,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  });
}

function escapeText(s: string): string {
  return s.replace(/[<>]/g, "");
}

type Props = {
  markers: StudentMapMarker[];
  onMarkerClick: (propertyId: string) => void;
};

function MapFitBounds({ markers }: { markers: StudentMapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].latitude, markers[0].longitude], 16, {
        animate: false,
      });
      return;
    }
    const bounds = L.latLngBounds(
      markers.map((m) => [m.latitude, m.longitude] as [number, number])
    );
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16, animate: false });
  }, [map, markers]);
  return null;
}

export function StudentDormMap({ markers, onMarkerClick }: Props) {
  const center: [number, number] = useMemo(() => {
    if (markers.length === 0) return [8.4542, 124.6319];
    const sum = markers.reduce(
      (a, m) => ({ lat: a.lat + m.latitude, lng: a.lng + m.longitude }),
      { lat: 0, lng: 0 }
    );
    return [sum.lat / markers.length, sum.lng / markers.length];
  }, [markers]);

  return (
    <MapContainer
      center={center}
      zoom={markers.length === 1 ? 16 : 13}
      style={{ height: "100%", width: "100%" }}
      className="rounded-lg"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.length > 0 ? <MapFitBounds markers={markers} /> : null}
      {markers.map((p) => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={markerIcon(p)}
          eventHandlers={{
            click: () => onMarkerClick(p.id),
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -28]}
            opacity={1}
            className="dc-map-dorm-tooltip"
          >
            {p.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
