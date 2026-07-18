import { useCallback, useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import { apiRequest, type NotificationItem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// Configure notifications to show in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Request push notification permissions on mount
  useEffect(() => {
    void (async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
      } catch {
        // fail silently in environments without push support
      }
    })();
  }, []);

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

      // Trigger local push notification for new unread items after initial load
      if (isInitialized) {
        for (const item of newItems) {
          if (!item.read && !seenIds.has(item.id)) {
            try {
              void Notifications.scheduleNotificationAsync({
                content: {
                  title: item.title,
                  body: item.body,
                },
                trigger: null,
              });
            } catch {
              // fail silently
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
    const t = setInterval(() => void load(), 3_600_000); // poll every 1 hour
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
