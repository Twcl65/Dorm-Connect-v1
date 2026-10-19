import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppLogo } from "@/components/app-logo";
import { authTheme } from "@/lib/auth-theme";

type AuthScreenLayoutProps = {
  children: ReactNode;
  footer?: ReactNode;
  cardStyle?: ViewStyle;
};

export function AuthScreenLayout({
  children,
  footer,
  cardStyle,
}: AuthScreenLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.glowPrimary} pointerEvents="none" />
      <View style={styles.glowSecondary} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: Math.max(insets.top + 16, 48),
              paddingBottom: Math.max(insets.bottom + 24, 40),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.badge}>
              <Ionicons name="sparkles" size={14} color={authTheme.secondary} />
              <Text style={styles.badgeText}>
                Official USTP dormitory & boarding house portal
              </Text>
            </View>

            <AppLogo size="lg" variant="dark" />

            <Text style={styles.heroTitle}>
              Your trusted path to{" "}
              <Text style={styles.heroAccent}>accredited housing</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Discover OSA-approved dormitories near campus. Compare room rates,
              check availability, and manage reservations in one place.
            </Text>
          </View>

          <View style={[styles.card, cardStyle]}>{children}</View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: authTheme.background,
  },
  flex: { flex: 1 },
  glowPrimary: {
    position: "absolute",
    top: -40,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: authTheme.glowPrimary,
    opacity: 0.9,
  },
  glowSecondary: {
    position: "absolute",
    bottom: 120,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: authTheme.glowSecondary,
    opacity: 0.9,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    gap: 24,
  },
  hero: {
    alignItems: "center",
    gap: 14,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: authTheme.badgeBorder,
    backgroundColor: authTheme.badgeBg,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: authTheme.textSoft,
  },
  heroTitle: {
    textAlign: "center",
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
    color: authTheme.text,
    letterSpacing: -0.3,
  },
  heroAccent: {
    color: authTheme.brand,
  },
  heroSubtitle: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    color: authTheme.textMuted,
    maxWidth: 340,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    backgroundColor: authTheme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: authTheme.cardBorder,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  footer: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    gap: 8,
  },
});
