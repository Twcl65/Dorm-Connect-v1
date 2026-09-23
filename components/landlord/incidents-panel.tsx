"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

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
  landlordReply?: string | null;
  landlordRepliedAt?: string | null;
  tenantReply?: string | null;
  tenantRepliedAt?: string | null;
};

export type LandlordIncidentsPanelProps = {
  embedded?: boolean;
};

export function LandlordIncidentsPanel({
  embedded = false,
}: LandlordIncidentsPanelProps = {}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

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

  const sendReply = async (id: string) => {
    const reply = (replyDraft[id] ?? "").trim();
    if (!reply) return;
    setUpdating(id);
    setError(null);
    try {
      const res = await fetch(`/api/landlord/incidents/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Reply failed");
      setReplyDraft((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setUpdating(null);
    }
  };
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
      {!embedded ? (
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
      ) : (
        <div className="flex justify-end">
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
      )}

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
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3"
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
                
                {r.landlordReply ? (
                  <div className="space-y-4">
                    <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
                      <p className="font-semibold text-sky-800">Your Reply <span className="text-[0.65rem] font-normal text-sky-700">({new Date(r.landlordRepliedAt!).toLocaleString()})</span></p>
                      <p className="mt-1 whitespace-pre-wrap">{r.landlordReply}</p>
                    </div>

                    {r.tenantReply && (
                      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950 ml-4">
                        <p className="font-semibold text-blue-800">Tenant Reply <span className="text-[0.65rem] font-normal text-blue-700">({new Date(r.tenantRepliedAt!).toLocaleString()})</span></p>
                        <p className="mt-1 whitespace-pre-wrap">{r.tenantReply}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 mt-2">
                    <Textarea
                      placeholder="Type a reply to the student..."
                      className="min-h-[60px] text-xs"
                      value={replyDraft[r.id] ?? ""}
                      onChange={(e) =>
                        setReplyDraft((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-[0.7rem]"
                        disabled={updating === r.id || !(replyDraft[r.id] ?? "").trim()}
                        onClick={() => void sendReply(r.id)}
                      >
                        {updating === r.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                        Send Reply
                      </Button>
                    </div>
                  </div>
                )}

                {r.status !== "Resolved" ? (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
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
