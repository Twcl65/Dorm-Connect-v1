import { useCallback, useEffect, useRef, useState } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiRequest, type NotificationItem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { loadNotifications } from "@/lib/native-notifications";

void loadNotifications().then((Notifications) => {
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
});

/** Register for Expo push notifications and return the token string. */
async function registerForPushNotifications(): Promise<string | null> {
  try {
    const Notifications = await loadNotifications();
    if (!Notifications) return null;

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1e3a5f",
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData.data;
  } catch (err) {
    if (__DEV__) console.warn("[push] Failed to get push token:", err);
    return null;
  }
}

export function useNotifications() {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const pushTokenRegistered = useRef(false);

  // Register push token with server when auth token is available
  useEffect(() => {
    if (!token || pushTokenRegistered.current) return;
    void (async () => {
      const expoPushToken = await registerForPushNotifications();
      if (!expoPushToken) return;
      try {
        await apiRequest("/api/push-token", {
          token,
          method: "POST",
          body: { token: expoPushToken },
        });
        pushTokenRegistered.current = true;
        if (__DEV__) console.log("[push] Registered token:", expoPushToken);
      } catch (err) {
        if (__DEV__) console.warn("[push] Failed to register token:", err);
      }
    })();
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ notifications: NotificationItem[] }>(
        "/api/notifications",
        { token }
      );
      const newItems = res.notifications ?? [];
      setItems(newItems);

      if (isInitialized) {
        const Notifications = await loadNotifications();
        if (Notifications) {
          for (const item of newItems) {
            if (!item.read && !seenIds.has(item.id)) {
              try {
                void Notifications.scheduleNotificationAsync({
                  content: {
                    title: item.title,
                    body: item.body,
                    ...(Platform.OS === "android"
                      ? { channelId: "default" }
                      : {}),
                  },
                  trigger: null,
                });
              } catch {
                // fail silently
              }
            }
          }
        }
      }

      // Update seen items set
      const nextSeen = new Set<string>();
      for (const item of newItems) {
        nextSeen.add(item.id);
      }
      setSeenIds(nextSeen);
      setIsInitialized(true);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, isInitialized, seenIds]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 900_000); // 15 minutes
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    if (!token || id.startsWith("synthetic-")) return;
    await apiRequest("/api/notifications", {
      method: "PATCH",
      token,
      body: { id },
    });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllRead = async () => {
    if (!token) return;
    await apiRequest("/api/notifications", {
      method: "PATCH",
      token,
      body: { markAllRead: true },
    });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return { items, loading, unread, load, markRead, markAllRead };
}
