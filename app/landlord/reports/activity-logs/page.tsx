"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

type LogRow = { id: string; description: string; createdAt: string };
type ApiResponse = {
  page: number;
  pageSize: number;
  total: number;
  logs: LogRow[];
  error?: string;
};

export default function LandlordActivityLogsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [data, setData] = useState<ApiResponse | null>(null);

  const totalPages = useMemo(() => {
    const total = data?.total ?? 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [data?.total, pageSize]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/landlord/activity-logs?${params}`, {
        credentials: "include",
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(json.error ?? "Failed to load activity logs");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activity logs");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity Logs</h1>
          <p className="text-sm text-muted-foreground">
            Monitoring page for actions related to your landlord account.
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
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Loading…
            </>
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

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800">
                Log History
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Search and review your activity log entries.
              </p>
            </div>
            <div className="w-full sm:w-72">
              <Input
                placeholder="Search description..."
                className="h-8 bg-muted text-xs"
                value={q}
                onChange={(e) => {
                  setPage(1);
                  setQ(e.target.value);
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (data?.logs?.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No activity logs found.
            </p>
          ) : (
            <ul className="space-y-2">
              {data!.logs.map((l) => (
                <li
                  key={l.id}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <p className="text-xs font-medium text-slate-900">
                    {l.description}
                  </p>
                  <p className="text-[0.7rem] text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.7rem] text-muted-foreground">
              Showing page {data?.page ?? page} of {totalPages} •{" "}
              {data?.total ?? 0} total
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[0.7rem]"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || page <= 1}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[0.7rem]"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={loading || page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

