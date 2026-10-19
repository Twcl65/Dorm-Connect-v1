import { Tabs, Redirect } from "expo-router";
import { View } from "react-native";
import { AppHeader } from "@/components/app-header";
import { TabBarIcon } from "@/components/tab-bar-icon";
import { CenteredLoader, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

const tabHeader = {
  headerShown: true,
  header: () => <AppHeader />,
  headerStyle: { backgroundColor: colors.brand },
  headerShadowVisible: false,
  headerTitle: "",
};

export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <CenteredLoader />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (user.role === "Landlord") return <Redirect href="/(landlord-tabs)" />;

  return (
    <Tabs
      screenOptions={{
        ...tabHeader,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.white,
        },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon id="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          tabBarLabel: "Browse",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon id="browse" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          tabBarLabel: "Reservation",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon id="reservations" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          tabBarLabel: "Payments",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon id="payments" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          tabBarLabel: "Incident Report",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon id="incidents" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarLabel: "More",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon id="more" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
