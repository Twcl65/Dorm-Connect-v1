"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/components/ui/utils";

type NotificationItem = {
  id: string;
  category: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  synthetic?: boolean;
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      const j = (await res.json()) as { notifications?: NotificationItem[] };
      if (res.ok) setItems(j.notifications ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    if (id.startsWith("synthetic-")) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-10 z-50 w-80 max-h-[min(70vh,420px)] overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-700 bg-[#031C2E] px-3 py-2">
              <p className="text-xs font-semibold text-white">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  className="text-[0.65rem] text-sky-200 hover:underline"
                  onClick={async () => {
                    await fetch("/api/notifications", {
                      method: "PATCH",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ markAllRead: true }),
                    });
                    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[min(60vh,360px)] overflow-y-auto bg-white">
              {loading && items.length === 0 ? (
                <p className="px-3 py-4 text-[0.7rem] text-slate-500">Loading…</p>
              ) : items.length === 0 ? (
                <p className="px-3 py-4 text-[0.7rem] text-slate-500">
                  No notifications yet.
                </p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={cn(
                      "block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50",
                      !n.read && "bg-sky-50/60"
                    )}
                    onClick={() => void markRead(n.id)}
                  >
                    <p className="text-[0.7rem] font-semibold text-slate-900">
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-[0.65rem] text-slate-600 line-clamp-2">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[0.6rem] text-slate-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
