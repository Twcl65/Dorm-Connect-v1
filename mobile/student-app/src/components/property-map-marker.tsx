import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "@/components/ui";

export type MapMarkerData = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  coverImageUrl?: string | null;
};

export function PropertyMapMarker({
  name,
  coverImageUrl,
  selected,
}: {
  name: string;
  coverImageUrl?: string | null;
  selected?: boolean;
}) {
  const label = name.length > 28 ? `${name.slice(0, 26)}…` : name;
  const initials = name.trim().slice(0, 3).toUpperCase() || "DC";

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <View style={[styles.circle, selected && styles.circleSelected]}>
        {coverImageUrl ? (
          <Image source={{ uri: coverImageUrl }} style={styles.image} />
        ) : (
          <Text style={styles.initials}>{initials}</Text>
        )}
      </View>
    </View>
  );
}

const CIRCLE = 52;

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    width: 140,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.navy,
    textAlign: "center",
    marginBottom: 6,
    maxWidth: 136,
    textShadowColor: "rgba(255,255,255,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 3,
    borderColor: colors.emerald,
    backgroundColor: colors.white,
    overflow: "hidden",
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
    borderWidth: 4,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  initials: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
  },
});
