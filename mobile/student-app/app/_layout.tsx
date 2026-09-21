import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppHeader } from "@/components/app-header";
import { AuthSplashLoader } from "@/components/auth-splash-loader";
import { colors } from "@/components/ui";
import { AuthProvider, useAuth } from "@/context/AuthContext";

SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore if splash was already hidden */
});

function RootNavigator() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      void SplashScreen.hideAsync();
    }
  }, [loading]);

  if (loading) {
    return <AuthSplashLoader />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(landlord-tabs)" />
      <Stack.Screen name="landlord" options={{ headerShown: false }} />
      <Stack.Screen
        name="landlord-profile/[id]"
        options={{
          headerShown: true,
          header: () => <AppHeader showBack />,
          headerStyle: { backgroundColor: colors.brand },
          headerShadowVisible: false,
          headerTitle: "",
        }}
      />
      <Stack.Screen
        name="listing/[id]"
        options={{
          headerShown: true,
          header: () => <AppHeader showBack />,
          headerStyle: { backgroundColor: colors.brand },
          headerShadowVisible: false,
          headerTitle: "",
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: true,
          header: () => <AppHeader showBack />,
          headerStyle: { backgroundColor: colors.brand },
          headerShadowVisible: false,
          headerTitle: "",
        }}
      />
      <Stack.Screen
        name="reviews"
        options={{
          headerShown: true,
          header: () => <AppHeader showBack />,
          headerStyle: { backgroundColor: colors.brand },
          headerShadowVisible: false,
          headerTitle: "",
        }}
      />
      <Stack.Screen
        name="payment-receipt/[id]"
        options={{
          headerShown: true,
          header: () => <AppHeader showBack />,
          headerStyle: { backgroundColor: colors.brand },
          headerShadowVisible: false,
          headerTitle: "",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" backgroundColor={colors.brand} />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
