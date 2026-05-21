import { useEffect, useMemo, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from "react-native-maps";
import { spreadOverlappingMarkers } from "@/lib/spread-map-markers";
import { resolveMediaUrl } from "@/lib/config";
import {
  PropertyMapMarker,
  type MapMarkerData,
} from "@/components/property-map-marker";

const DEFAULT_REGION: Region = {
  latitude: 8.4542,
  longitude: 124.6319,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

type Props = {
  markers: MapMarkerData[];
  selectedId?: string | null;
  onMarkerPress: (propertyId: string) => void;
};

export function StudentDormMap({ markers, selectedId, onMarkerPress }: Props) {
  const mapRef = useRef<MapView>(null);

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

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={Platform.OS === "android"}
      >
        {displayMarkers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{
              latitude: m.latitude,
              longitude: m.longitude,
            }}
            onPress={() => onMarkerPress(m.id)}
            anchor={{ x: 0.5, y: 0.92 }}
          >
            <PropertyMapMarker
              name={m.name}
              coverImageUrl={m.coverImageUrl}
              selected={selectedId === m.id}
            />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 220 },
  map: { ...StyleSheet.absoluteFillObject },
});
