import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppHeader } from "@/components/app-header";
import { colors } from "@/components/ui";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" backgroundColor={colors.brand} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(landlord-tabs)" />
        <Stack.Screen name="landlord" options={{ headerShown: false }} />
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
      </Stack>
    </AuthProvider>
  );
}
