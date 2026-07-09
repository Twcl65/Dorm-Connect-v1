import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import MapView, { PROVIDER_DEFAULT, type Region } from "react-native-maps";
import { spreadOverlappingMarkers } from "@/lib/spread-map-markers";
import { resolveMediaUrl } from "@/lib/config";
import {
  PropertyMapMarker,
  MARKER_ANCHOR_OFFSET_Y,
  MARKER_WIDTH,
  type MapMarkerData,
} from "@/components/property-map-marker";

const DEFAULT_REGION: Region = {
  latitude: 8.4542,
  longitude: 124.6319,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

type ScreenPoint = { x: number; y: number };

type Props = {
  markers: MapMarkerData[];
  selectedId?: string | null;
  onMarkerPress: (propertyId: string) => void;
};

export function StudentDormMap({ markers, selectedId, onMarkerPress }: Props) {
  const mapRef = useRef<MapView>(null);
  const [positions, setPositions] = useState<Record<string, ScreenPoint>>({});
  const layoutTick = useRef(0);

  const displayMarkers = useMemo(
    () =>
      spreadOverlappingMarkers(
        markers.map((m) => ({
          ...m,
          coverImageUrl: resolveMediaUrl(m.coverImageUrl ?? null),
        }))
      ),
    [markers]
  );

  const updatePositions = useCallback(async () => {
    const map = mapRef.current;
    if (!map || displayMarkers.length === 0) {
      setPositions({});
      return;
    }
    const next: Record<string, ScreenPoint> = {};
    await Promise.all(
      displayMarkers.map(async (m) => {
        try {
          const point = await map.pointForCoordinate({
            latitude: m.latitude,
            longitude: m.longitude,
          });
          if (
            point &&
            Number.isFinite(point.x) &&
            Number.isFinite(point.y)
          ) {
            next[m.id] = point;
          }
        } catch {
          /* map not ready */
        }
      })
    );
    setPositions(next);
  }, [displayMarkers]);

  const schedulePositionUpdate = useCallback(() => {
    layoutTick.current += 1;
    const tick = layoutTick.current;
    requestAnimationFrame(() => {
      if (tick !== layoutTick.current) return;
      void updatePositions();
    });
  }, [updatePositions]);

  useEffect(() => {
    schedulePositionUpdate();
  }, [displayMarkers, schedulePositionUpdate]);

  useEffect(() => {
    if (!mapRef.current || displayMarkers.length === 0) return;
    if (displayMarkers.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: displayMarkers[0].latitude,
          longitude: displayMarkers[0].longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        300
      );
      return;
    }
    mapRef.current.fitToCoordinates(
      displayMarkers.map((m) => ({
        latitude: m.latitude,
        longitude: m.longitude,
      })),
      {
        edgePadding: { top: 72, right: 48, bottom: 48, left: 48 },
        animated: true,
      }
    );
  }, [displayMarkers]);

  const initialRegion = useMemo((): Region => {
    if (displayMarkers.length === 0) return DEFAULT_REGION;
    const sum = displayMarkers.reduce(
      (a, m) => ({ lat: a.lat + m.latitude, lng: a.lng + m.longitude }),
      { lat: 0, lng: 0 }
    );
    return {
      latitude: sum.lat / displayMarkers.length,
      longitude: sum.lng / displayMarkers.length,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  }, [displayMarkers]);

  const onMapLayout = (_e: LayoutChangeEvent) => {
    schedulePositionUpdate();
  };

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={Platform.OS === "android"}
        onMapReady={schedulePositionUpdate}
        onLayout={onMapLayout}
        onRegionChangeComplete={schedulePositionUpdate}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        {displayMarkers.map((m) => {
          const point = positions[m.id];
          if (!point) return null;
          const left = point.x - MARKER_WIDTH / 2;
          const top = point.y - MARKER_ANCHOR_OFFSET_Y;
          return (
            <Pressable
              key={m.id}
              style={[
                styles.markerHit,
                {
                  left,
                  top,
                  zIndex: selectedId === m.id ? 20 : 10,
                },
              ]}
              onPress={() => onMarkerPress(m.id)}
              accessibilityRole="button"
              accessibilityLabel={`${m.name} dorm marker`}
            >
              <PropertyMapMarker
                name={m.name}
                coverImageUrl={m.coverImageUrl}
                selected={selectedId === m.id}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 220 },
  map: { ...StyleSheet.absoluteFillObject },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "visible",
  },
  markerHit: {
    position: "absolute",
    width: MARKER_WIDTH,
  },
});
