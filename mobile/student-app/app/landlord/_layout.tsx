import { Stack } from "expo-router";
import { AppHeader } from "@/components/app-header";
import { colors } from "@/components/ui";

export default function LandlordStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        header: () => <AppHeader showBack />,
        headerStyle: { backgroundColor: colors.brand },
        headerShadowVisible: false,
        headerTitle: "",
      }}
    />
  );
}
