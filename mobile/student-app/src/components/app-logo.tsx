import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/components/ui";

type Props = {
  size?: "md" | "lg";
  showName?: boolean;
};

export function AppLogo({ size = "lg", showName = true }: Props) {
  const box = size === "lg" ? 64 : 48;
  const icon = size === "lg" ? 30 : 22;

  return (
    <View style={styles.wrap}>
      <View style={[styles.mark, { width: box, height: box, borderRadius: box / 4 }]}>
        <Ionicons name="home" size={icon} color={colors.brand} />
      </View>
      {showName ? (
        <Text style={[styles.name, size === "lg" && styles.nameLg]}>DORMCONNECT</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 12 },
  mark: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(255, 151, 24, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  name: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2,
    color: colors.brand,
  },
  nameLg: {
    fontSize: 26,
    letterSpacing: 2.5,
  },
});
