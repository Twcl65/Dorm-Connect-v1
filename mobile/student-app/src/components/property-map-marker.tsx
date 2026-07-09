import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "@/components/ui";

export type MapMarkerData = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  coverImageUrl?: string | null;
};

/** Match web Leaflet icon (student-properties-map.tsx). */
export const MARKER_WIDTH = 140;
export const MARKER_CIRCLE = 52;
const LABEL_BLOCK = 32;
const LABEL_GAP = 6;
export const MARKER_HEIGHT = LABEL_BLOCK + LABEL_GAP + MARKER_CIRCLE;

/** Distance from marker top to circle center (map coordinate anchor). */
export const MARKER_ANCHOR_OFFSET_Y = LABEL_BLOCK + LABEL_GAP + MARKER_CIRCLE / 2;

export function PropertyMapMarker({
  name,
  coverImageUrl,
  selected,
}: {
  name: string;
  coverImageUrl?: string | null;
  selected?: boolean;
}) {
  const label = name.length > 32 ? `${name.slice(0, 30)}…` : name;
  const initials = name.trim().slice(0, 3).toUpperCase() || "DC";
  const borderW = selected ? 4 : 3;
  const innerSize = MARKER_CIRCLE - borderW * 2;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.labelBox}>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <View style={{ height: LABEL_GAP }} />
      <View
        style={[
          styles.circle,
          selected && styles.circleSelected,
          {
            width: MARKER_CIRCLE,
            height: MARKER_CIRCLE,
            borderRadius: MARKER_CIRCLE / 2,
            borderWidth: borderW,
          },
        ]}
      >
        {coverImageUrl ? (
          <View
            style={{
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
              overflow: "hidden",
              backgroundColor: colors.white,
            }}
          >
            <Image
              source={{ uri: coverImageUrl }}
              style={{ width: innerSize, height: innerSize }}
              resizeMode="cover"
            />
          </View>
        ) : (
          <Text style={styles.initials}>{initials}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: "center",
  },
  labelBox: {
    width: MARKER_WIDTH,
    minHeight: LABEL_BLOCK,
    maxHeight: LABEL_BLOCK,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#14532d",
    textAlign: "center",
    lineHeight: 14,
  },
  circle: {
    borderColor: colors.emerald,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  circleSelected: {
    borderColor: colors.sky,
  },
  initials: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
  },
});
