"use client";

import { useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const DEFAULT_CENTER: [number, number] = [8.4542, 124.6319];

type Props = {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
};

export function MapLocationPicker({
  latitude,
  longitude,
  onChange,
  height = 240,
}: Props) {
  const center: [number, number] = useMemo(() => {
    if (
      latitude != null &&
      longitude != null &&
      !Number.isNaN(latitude) &&
      !Number.isNaN(longitude)
    ) {
      return [latitude, longitude];
    }
    return DEFAULT_CENTER;
  }, [latitude, longitude]);

  const zoom =
    latitude != null && longitude != null && !Number.isNaN(latitude) ? 17 : 13;

  return (
    <div
      className="w-full overflow-hidden rounded-md border border-slate-200"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onPick={onChange} />
        {latitude != null &&
          longitude != null &&
          !Number.isNaN(latitude) &&
          !Number.isNaN(longitude) && (
            <CircleMarker
              center={[latitude, longitude]}
              radius={11}
              pathOptions={{
                color: "#15803d",
                fillColor: "#22c55e",
                fillOpacity: 0.9,
                weight: 2,
              }}
            />
          )}
      </MapContainer>
    </div>
  );
}
