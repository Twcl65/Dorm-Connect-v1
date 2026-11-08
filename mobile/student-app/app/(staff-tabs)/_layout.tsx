import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";
import { AppHeader } from "@/components/app-header";
import { CenteredLoader, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

const tabHeader = {
  headerShown: true,
  header: () => <AppHeader />,
  headerStyle: { backgroundColor: colors.brand },
  headerShadowVisible: false,
  headerTitle: "",
};

export default function StaffTabsLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <CenteredLoader />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (user.role !== "Staff") return <Redirect href="/" />;

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
        tabBarLabelStyle: { fontSize: 9 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="inspections"
        options={{
          title: "Inspections",
          tabBarLabel: "Inspections",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "clipboard" : "clipboard-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="accreditation"
        options={{
          title: "Accreditation",
          tabBarLabel: "Accreditation",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "ribbon" : "ribbon-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tenants"
        options={{
          title: "Tenant Monitoring",
          tabBarLabel: "Tenants",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "people" : "people-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Menu",
          tabBarLabel: "Menu",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "menu" : "menu-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
