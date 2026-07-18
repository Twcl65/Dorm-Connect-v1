import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NotificationsModal } from "@/components/notifications-modal";
import { colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/use-notifications";

type Props = {
  showBack?: boolean;
  onBack?: () => void;
};

export function AppHeader({ showBack, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const isLandlord = user?.role === "Landlord";
  const { items, loading, unread, load, markRead, markAllRead } =
    useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            paddingTop: insets.top,
            backgroundColor: colors.brand,
          },
        ]}
      >
        <View style={styles.row}>
          {showBack ? (
            <Pressable
              onPress={handleBack}
              style={styles.backBtn}
              hitSlop={8}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={26} color={colors.white} />
            </Pressable>
          ) : null}

          <View style={styles.brand}>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.logoImage}
              resizeMode="cover"
            />
            <Text style={styles.brandName}>DORMCONNECT</Text>
          </View>

          <Pressable
            style={styles.bellBtn}
            onPress={() => {
              void load();
              setNotifOpen(true);
            }}
            accessibilityLabel="Notifications"
            hitSlop={8}
          >
            <Ionicons
              name={unread > 0 ? "notifications" : "notifications-outline"}
              size={24}
              color={colors.white}
            />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unread > 9 ? "9+" : unread}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <NotificationsModal
        visible={notifOpen}
        onClose={() => setNotifOpen(false)}
        items={items}
        loading={loading}
        unread={unread}
        onRefresh={() => load()}
        onMarkRead={(id) => void markRead(id)}
        onMarkAllRead={() => void markAllRead()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    minHeight: 48,
  },
  backBtn: { marginRight: 4, padding: 2 },
  brand: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
  },
  logoImage: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  brandName: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: 1.2,
  },
  bellBtn: { padding: 6, position: "relative" },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "700",
  },
});
