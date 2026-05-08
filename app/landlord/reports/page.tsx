"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

type PaymentStatus = "Paid" | "Pending" | "Overdue";
type PaymentMethod = "GCash" | "Cash" | "Bank Transfer";

type Payment = {
  id: string;
  source?: "landlord" | "student";
  roomNo: string;
  name: string;
  amount: string;
  amountValue: number;
  method: PaymentMethod;
  status: PaymentStatus;
  date?: string;
  periodLabel?: string;
  createdAt?: string;
};

type ActivityLog = {
  id: string;
  description: string;
  createdAt: string;
};

type LeaseStats = {
  total: number;
  activeLeases: number;
  paid: number;
  pending: number;
  overdue: number;
};

type ReservationStats = {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  const colorClasses =
    status === "Paid"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Pending"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return (
    <Badge
      className={`${colorClasses} rounded-full px-3 py-1 text-xs font-medium`}
      variant="outline"
    >
      {status}
    </Badge>
  );
}

function formatPhp(n: number) {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

export default function LandlordManageDormReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [pRes, lRes] = await Promise.all([
        fetch("/api/landlord/payments", { credentials: "include" }),
        fetch("/api/landlord/activity-logs?page=1&pageSize=12", {
          credentials: "include",
        }),
      ]);

      const pj = (await pRes.json()) as { payments?: Payment[]; error?: string };
      const lj = (await lRes.json()) as {
        logs?: ActivityLog[];
        error?: string;
      };

      if (!pRes.ok) throw new Error(pj.error ?? "Failed to load transactions");
      if (!lRes.ok) throw new Error(lj.error ?? "Failed to load activity logs");

      setPayments(pj.payments ?? []);
      setLogs(lj.logs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
      setPayments([]);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) => {
      const src = p.source === "student" ? "student app" : "manual";
      return (
        p.id.toLowerCase().includes(q) ||
        p.roomNo.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        src.includes(q) ||
        p.status.toLowerCase().includes(q) ||
        p.method.toLowerCase().includes(q) ||
        (p.periodLabel ?? "").toLowerCase().includes(q)
      );
    });
  }, [payments, search]);

  const totals = useMemo(() => {
    const paid = filteredPayments.filter((p) => p.status === "Paid");
    const pending = filteredPayments.filter((p) => p.status === "Pending");
    const overdue = filteredPayments.filter((p) => p.status === "Overdue");
    const totalPaid = paid.reduce((sum, p) => sum + (Number(p.amountValue) || 0), 0);
    return {
      totalPaid,
      paidCount: paid.length,
      pendingCount: pending.length,
      overdueCount: overdue.length,
      totalCount: filteredPayments.length,
    };
  }, [filteredPayments]);

  const recentPayments = filteredPayments.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Manage Dorm Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Transaction reports and activity monitoring for your dorm operations.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs self-start sm:self-auto"
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
          <CardTitle className="text-sm font-semibold text-slate-800">
            Downloadable Reports
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <a href="/api/landlord/reports/tenants" className="inline-block">
              <Button type="button" size="sm" className="h-8 text-xs">
                Download Tenant Report DOCX
              </Button>
            </a>
            <a
              href="/api/landlord/reports/reservations"
              className="inline-block"
            >
              <Button type="button" size="sm" className="h-8 text-xs">
                Download Reservation Report DOCX
              </Button>
            </a>
            <a href="/api/landlord/reports/payments" className="inline-block">
              <Button type="button" size="sm" className="h-8 text-xs">
                Download Payment Report DOCX
              </Button>
            </a>
            <a href="/api/landlord/reports/rooms" className="inline-block">
              <Button type="button" size="sm" className="h-8 text-xs">
                Download Room Report DOCX
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="border border-gray-300 bg-white">
            <CardHeader className="pb-3 border-b bg-muted/40">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Transaction Reports
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Summary of payments recorded in the system (student + manual).
                  </p>
                </div>
                <div className="w-full sm:w-60">
                  <Input
                    placeholder="Search transactions..."
                    className="h-8 bg-muted text-xs"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[0.7rem] text-muted-foreground">Total paid</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatPhp(totals.totalPaid)}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[0.7rem] text-muted-foreground">Paid</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {totals.paidCount}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[0.7rem] text-muted-foreground">Pending</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {totals.pendingCount}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[0.7rem] text-muted-foreground">Overdue</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {totals.overdueCount}
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white">
                <Table bordered={false}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-8 text-center text-xs text-muted-foreground"
                        >
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : recentPayments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-8 text-center text-xs text-muted-foreground"
                        >
                          No transactions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentPayments.map((p) => (
                        <TableRow key={`${p.source ?? "landlord"}-${p.id}`}>
                          <TableCell className="text-xs font-mono text-slate-500">
                            {p.id.slice(0, 8)}…
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {p.source === "student" ? "Student app" : "Manual"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                            {p.periodLabel ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700">
                            {p.roomNo}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-slate-800">
                            {p.name}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700">
                            {p.amount}
                          </TableCell>
                          <TableCell className="text-xs text-slate-700">
                            {p.method}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <p className="text-[0.7rem] text-muted-foreground">
                Showing 10 of {totals.totalCount} matching transactions. For full
                details, use the Payments page.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-gray-300 bg-white">
          <CardHeader className="pb-3 border-b bg-muted/40">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-800">
                  Activity Logs
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Latest system actions for your landlord account.
                </p>
              </div>
              <Link
                href="/landlord/reports/activity-logs"
                className="text-xs font-medium text-sky-700 hover:underline"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-3">
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No activity logs yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {logs.map((l) => (
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
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[0.7rem] text-slate-700">
              Use Activity Logs for better monitoring and auditing of actions.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

