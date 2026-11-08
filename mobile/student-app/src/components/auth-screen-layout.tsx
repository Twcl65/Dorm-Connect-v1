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
            <AppLogo size="lg" variant="dark" />

            <Text style={styles.heroTitle}>
              Your trusted path to{" "}
              <Text style={styles.heroAccent}>accredited housing</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Discover OSA-approved dormitories near the USTP-Jasaan campus.
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
  heroTitle: {
    textAlign: "center",
    fontSize: 20,
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
    fontSize: 12,
    lineHeight: 20,
    color: authTheme.textMuted,
    maxWidth: 350,
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
