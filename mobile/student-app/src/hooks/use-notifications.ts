import { useCallback, useEffect, useState } from "react";
import { apiRequest, type NotificationItem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export function useNotifications() {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ notifications: NotificationItem[] }>(
        "/api/notifications",
        { token }
      );
      setItems(res.notifications ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
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
