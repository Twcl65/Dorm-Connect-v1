"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function LandlordAnnouncementsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<
    { id: string; title: string; message: string; date: string }[]
  >([]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/landlord/announcements", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        error?: string;
        announcements?: typeof items;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setItems(json.announcements ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground">
          Official notices from the Office of Student Affairs for dorm operators.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No announcements yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <Card key={a.id} className="border border-gray-300 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{a.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{a.date}</p>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-slate-700 whitespace-pre-wrap">
                {a.message}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
