import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { authTheme } from "@/lib/auth-theme";

/** Dark startup view — matches native splash and landing hero. */
export function AuthSplashLoader() {
  return (
    <View style={styles.root}>
      <View style={styles.glowPrimary} pointerEvents="none" />
      <View style={styles.glowSecondary} pointerEvents="none" />
      <View style={styles.content}>
        <View style={styles.logoMark}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>DormConnect</Text>
        <Text style={styles.subtitle}>USTP</Text>
        <ActivityIndicator
          size="large"
          color={authTheme.brand}
          style={styles.spinner}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: authTheme.background,
    alignItems: "center",
    justifyContent: "center",
  },
  glowPrimary: {
    position: "absolute",
    top: "18%",
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: authTheme.glowPrimary,
  },
  glowSecondary: {
    position: "absolute",
    bottom: "20%",
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: authTheme.glowSecondary,
  },
  content: {
    alignItems: "center",
    gap: 8,
  },
  logoMark: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: authTheme.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 4,
    color: authTheme.textDim,
  },
  spinner: {
    marginTop: 28,
  },
});
