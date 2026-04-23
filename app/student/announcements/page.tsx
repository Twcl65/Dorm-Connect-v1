"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const NEW_THRESHOLD_DAYS = 7;

function isNewAnnouncement(dateStr: string) {
  const createdAt = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= NEW_THRESHOLD_DAYS;
}

type Row = {
  id: string;
  title: string;
  message: string;
  date: string;
  source?: "osa" | "landlord";
  propertyName?: string;
};

export default function StudentAnnouncementsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/announcements", {
        credentials: "include",
      });
      const json = (await res.json()) as { announcements?: Row[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setRows(json.announcements ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Announcements
          </h1>
          <p className="text-sm text-muted-foreground">
            Official notices from OSA and messages from landlords where you
            have an active booking.
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
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            "Refresh"
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}

      <div className="space-y-3">
        {rows.map((a) => {
          const isNew = isNewAnnouncement(a.date);
          return (
            <Card key={a.id} className="border border-gray-200 bg-white">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    {a.title}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.source === "landlord" && a.propertyName ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.6rem] font-medium text-amber-900"
                      >
                        Landlord · {a.propertyName}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="rounded-full px-2 py-0.5 text-[0.6rem]"
                      >
                        OSA
                      </Badge>
                    )}
                    <Badge
                      className={
                        isNew
                          ? "rounded-full bg-emerald-100 px-3 py-1 text-[0.65rem] font-semibold text-emerald-800"
                          : "rounded-full bg-slate-100 px-3 py-1 text-[0.65rem] font-medium text-slate-600"
                      }
                    >
                      {isNew ? "New" : "Archive"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-[0.7rem] text-muted-foreground">{a.date}</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {a.message}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && rows.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">No announcements yet.</p>
      )}
    </div>
  );
}
