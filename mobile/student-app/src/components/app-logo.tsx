import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "@/components/ui";
import { authTheme } from "@/lib/auth-theme";

type Props = {
  size?: "md" | "lg";
  showName?: boolean;
  variant?: "light" | "dark";
};

export function AppLogo({
  size = "lg",
  showName = true,
  variant = "light",
}: Props) {
  const box = size === "lg" ? 64 : 48;
  const isDark = variant === "dark";

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.mark,
          isDark && styles.markDark,
          { width: box, height: box, borderRadius: box / 4 },
        ]}
      >
        <Image
          source={require("../../assets/icon.png")}
          style={{ width: box - 8, height: box - 8, borderRadius: (box - 8) / 5 }}
          resizeMode="contain"
        />
      </View>
      {showName ? (
        <View style={styles.nameBlock}>
          <Text
            style={[
              styles.name,
              size === "lg" && styles.nameLg,
              isDark && styles.nameDark,
            ]}
          >
            DormConnect
          </Text>
          {isDark ? (
            <Text style={styles.ustpLabel}>USTP</Text>
          ) : null}
        </View>
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
  markDark: {
    borderColor: "rgba(255, 255, 255, 0.15)",
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  nameBlock: {
    alignItems: "center",
    gap: 2,
  },
  name: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1,
    color: colors.brand,
  },
  nameLg: {
    fontSize: 26,
    letterSpacing: 1.2,
  },
  nameDark: {
    color: authTheme.text,
  },
  ustpLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
    color: authTheme.textDim,
    textTransform: "uppercase",
  },
});
