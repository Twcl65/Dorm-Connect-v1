import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { spreadOverlappingMarkers } from "@/lib/spread-map-markers";
import { normalizeMapMarkers } from "@/lib/map-coords";
import { buildLeafletMapHtml } from "@/lib/leaflet-map-html";
import { resolveMediaUrl } from "@/lib/config";
import type { MapMarkerData } from "@/components/property-map-marker";

type Props = {
  markers: MapMarkerData[];
  selectedId?: string | null;
  onMarkerPress: (propertyId: string) => void;
};

export function StudentDormMap({ markers, selectedId, onMarkerPress }: Props) {
  const displayMarkers = useMemo(() => {
    const valid = normalizeMapMarkers(markers);
    return spreadOverlappingMarkers(
      valid.map((m) => ({
        ...m,
        coverImageUrl: resolveMediaUrl(m.coverImageUrl ?? null),
      }))
    );
  }, [markers]);

  const html = useMemo(
    () => buildLeafletMapHtml(displayMarkers, selectedId),
    [displayMarkers, selectedId]
  );

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        id?: string;
      };
      if (data.type === "marker" && data.id) {
        onMarkerPress(data.id);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <WebView
      style={styles.map}
      source={{ html }}
      originWhitelist={["*"]}
      onMessage={onMessage}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      bounces={false}
      setSupportMultipleWindows={false}
      allowsInlineMediaPlayback
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: "#f1f5f9" },
});
