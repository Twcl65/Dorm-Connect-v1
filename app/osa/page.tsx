"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye } from "lucide-react";
import {
  AccreditationProgressChart,
  type AccreditationProgressSegment,
} from "@/components/osa/accreditation-progress-chart";

type RecentRequest = {
  id: string;
  name: string;
  owner: string;
  date: string;
  status: string;
};

export default function OsaDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    pendingAccreditation: 0,
    approvedDorms: 0,
    rejectedApplications: 0,
    needsDocuments: 0,
    dormsNotOperating: 0,
    complianceAlerts: 0,
  });
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [accreditationProgress, setAccreditationProgress] = useState<
    AccreditationProgressSegment[]
  >([]);
  const [selectedRequest, setSelectedRequest] = useState<RecentRequest | null>(
    null
  );
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/osa/overview", { credentials: "include" });
      const json = (await res.json()) as {
        error?: string;
        pendingAccreditation?: number;
        approvedDorms?: number;
        rejectedApplications?: number;
        needsDocuments?: number;
        dormsNotOperating?: number;
        complianceAlerts?: number;
        recentRequests?: RecentRequest[];
        accreditationProgress?: AccreditationProgressSegment[];
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load overview");
      setStats({
        pendingAccreditation: json.pendingAccreditation ?? 0,
        approvedDorms: json.approvedDorms ?? 0,
        rejectedApplications: json.rejectedApplications ?? 0,
        needsDocuments: json.needsDocuments ?? 0,
        dormsNotOperating: json.dormsNotOperating ?? 0,
        complianceAlerts: json.complianceAlerts ?? 0,
      });
      setRecentRequests(json.recentRequests ?? []);
      setAccreditationProgress(json.accreditationProgress ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = [
    {
      label: "Pending accreditation",
      value: String(stats.pendingAccreditation),
      badge: "Queue",
      badgeVariant: "warning" as const,
    },
    {
      label: "Approved dorms",
      value: String(stats.approvedDorms),
      badge: "Accredited",
      badgeVariant: "success" as const,
    },
    {
      label: "Rejected applications",
      value: String(stats.rejectedApplications),
      badge: "Rejected",
      badgeVariant: "destructive" as const,
    },
    {
      label: "Awaiting documents",
      value: String(stats.needsDocuments),
      badge: "Follow-up",
      badgeVariant: "secondary" as const,
    },
    {
      label: "Dorms not operating",
      value: String(stats.dormsNotOperating),
      badge: "Closed",
      badgeVariant: "muted" as const,
    },
    {
      label: "Compliance alerts",
      value: String(stats.complianceAlerts),
      badge: "Attention",
      badgeVariant: "warning" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            OSA Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Accreditation and compliance overview for USTP-affiliated dormitories.
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
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card
            key={card.label}
            className="border border-gray-300 bg-white shadow-sm"
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between pt-0">
              <p className="text-2xl font-semibold tracking-tight">
                {loading ? "—" : card.value}
              </p>
              <Badge
                variant={card.badgeVariant as never}
                className="text-[0.7rem]"
              >
                {card.badge}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-gray-300 bg-white">
          <CardHeader className="pb-2 pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-semibold text-slate-800">
                  Accreditation monitoring progress
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Breakdown of all accreditation requests by current status.
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-7 shrink-0 text-[0.7rem]"
              >
                <Link href="/osa/accreditation-monitoring">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-4">
            <AccreditationProgressChart
              segments={accreditationProgress}
              loading={loading}
            />
          </CardContent>
        </Card>

        <Card className="border border-gray-300 bg-white min-h-[290px]">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-sm font-semibold text-slate-800">
                Recent accreditation activity
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Latest submissions and status changes (all requests).
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="max-h-[520px] overflow-auto">
              <Table bordered={false}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Landlord</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-4 text-slate-600">
                      Review
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRequests.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        {loading
                          ? "Loading…"
                          : "No accreditation records yet."}
                      </TableCell>
                    </TableRow>
                  )}
                  {recentRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="px-4 text-xs font-mono text-slate-500">
                        {req.id.slice(0, 8)}…
                      </TableCell>
                      <TableCell className="px-4 text-sm font-medium text-slate-800">
                        {req.name}
                      </TableCell>
                      <TableCell className="px-4 text-xs text-slate-700">
                        {req.owner}
                      </TableCell>
                      <TableCell className="px-4 text-xs text-slate-600">
                        {req.date}
                      </TableCell>
                      <TableCell className="px-4 text-xs text-slate-700">
                        {req.status}
                      </TableCell>
                      <TableCell className="px-6 pr-4">
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                            onClick={() => {
                              setSelectedRequest(req);
                              setShowRequestDialog(true);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      {showRequestDialog && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-2xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Accreditation request summary
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowRequestDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-xs text-slate-800">
              <div className="grid gap-2 md:grid-cols-[120px,1fr] items-center">
                <span className="text-[0.7rem]">Reference</span>
                <Input
                  value={selectedRequest.id}
                  readOnly
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[0.7rem]">Dorm name</span>
                <Input
                  value={selectedRequest.name}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Landlord</span>
                <Input
                  value={selectedRequest.owner}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Date submitted</span>
                <Input
                  value={selectedRequest.date}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Status</span>
                <Input value={selectedRequest.status} readOnly className="h-8 text-xs" />
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[0.7rem] text-slate-700">
                <p>
                  Use the Accreditation page to approve applications, reject
                  them, or request additional documents from the landlord.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
