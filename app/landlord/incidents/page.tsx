"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type Report = {
  id: string;
  title: string;
  description: string;
  status: string;
  imageUrls: string[];
  createdAt: string;
  roomNo: string | null;
  propertyName: string | null;
  reporterName: string;
};

export default function LandlordIncidentsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/landlord/incidents", {
        credentials: "include",
      });
      const j = (await res.json()) as { reports?: Report[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to load");
      setReports(j.reports ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    setUpdating(id);
    setError(null);
    try {
      const res = await fetch(`/api/landlord/incidents/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Update failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Incident reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Reports from students about rooms in your properties.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-2 border-b bg-muted/40">
          <CardTitle className="text-sm font-semibold">Incoming reports</CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-4">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reports yet.</p>
          ) : (
            reports.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{r.title}</p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()} ·{" "}
                      {r.reporterName}
                    </p>
                    <p className="text-[0.7rem] mt-1">
                      {r.propertyName ?? "—"} — Room {r.roomNo ?? "—"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      r.status === "Resolved"
                        ? "border-emerald-200 bg-emerald-50 text-[0.65rem] font-medium text-emerald-900"
                        : "text-[0.65rem]"
                    }
                  >
                    {r.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-wrap">
                  {r.description}
                </p>
                {r.imageUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.imageUrls.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="h-20 w-28 rounded border object-cover"
                      />
                    ))}
                  </div>
                )}
                {r.status !== "Resolved" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[0.7rem]"
                      disabled={updating === r.id}
                      onClick={() => void setStatus(r.id, "Acknowledged")}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-[0.7rem]"
                      disabled={updating === r.id}
                      onClick={() => void setStatus(r.id, "Resolved")}
                    >
                      Mark resolved
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
