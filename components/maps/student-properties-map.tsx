"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
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

function escapeText(s: string): string {
  return s.replace(/[<>]/g, "");
}

const CIRCLE_SIZE = 52;
const LABEL_GAP = 6;
/** Room for label + gap + circle (anchor at circle center). */
const ICON_WIDTH = 140;
const LABEL_BLOCK = 32;
const ICON_HEIGHT = LABEL_BLOCK + LABEL_GAP + CIRCLE_SIZE;

function markerIcon(p: StudentMapMarker): L.DivIcon {
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

  const html = `<div class="dc-student-marker-wrap" title="${titleAttr}">
    <div class="dc-student-marker-label-above">${label}</div>
    <div class="dc-student-marker">${circleInner}</div>
  </div>`;

  return L.divIcon({
    className: "dc-map-div-icon",
    html,
    iconSize: [ICON_WIDTH, ICON_HEIGHT],
    iconAnchor: [ICON_WIDTH / 2, LABEL_BLOCK + LABEL_GAP + CIRCLE_SIZE / 2],
  });
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
    map.fitBounds(bounds, { padding: [72, 72], maxZoom: 16, animate: false });
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
        />
      ))}
    </MapContainer>
  );
}
