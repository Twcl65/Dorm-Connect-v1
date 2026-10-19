"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, CalendarIcon } from "lucide-react";
import Link from "next/link";

type MonthlySummary = {
  month: string;
  total: number;
  paid: number;
  count: number;
  tenants: string[];
  advanceTotal: number;
  depositTotal: number;
};

type TenantPayment = {
  id: string;
  source: string;
  dormName: string;
  roomNo: string;
  payerName: string;
  amount: number;
  method: string;
  status: string;
  date: string;
  periodLabel?: string;
};

type AdvanceSummary = {
  month: string;
  total: number;
  count: number;
  payer: string;
  property: string;
};

type DepositSummary = {
  month: string;
  total: number;
  count: number;
  payer: string;
  property: string;
};

function formatPhp(n: number): string {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  if (!m) return key;
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  return `${months[Number(m) - 1]} ${y}`;
}

type LandlordIncomeReportsPanelProps = {
  embedded?: boolean;
};

export function LandlordIncomeReportsPanel({ embedded = false }: LandlordIncomeReportsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    monthlySummary: MonthlySummary[];
    tenantPayments: TenantPayment[];
    advanceSummary: AdvanceSummary[];
    depositSummary: DepositSummary[];
    targetMonth: string;
  } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (typeof window !== "undefined") {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    return "";
  });

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/landlord/reports/income?month=${encodeURIComponent(selectedMonth ?? "")}`, { credentials: "include" });
      const json = (await res.json()) as {
        monthlySummary?: MonthlySummary[];
        tenantPayments?: TenantPayment[];
        advanceSummary?: AdvanceSummary[];
        depositSummary?: DepositSummary[];
        targetMonth?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load income reports");
      setData({
        monthlySummary: json.monthlySummary ?? [],
        tenantPayments: json.tenantPayments ?? [],
        advanceSummary: json.advanceSummary ?? [],
        depositSummary: json.depositSummary ?? [],
        targetMonth: json.targetMonth ?? "",
      });
      if (json.targetMonth) setSelectedMonth(json.targetMonth);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [selectedMonth]);

  const exportPdf = async () => {
    setError(null);
    try {
      const baseUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL || "";
      const url = new URL("/api/landlord/reports/income", baseUrl);
      if (selectedMonth) {
        url.searchParams.set("month", selectedMonth);
      }
      url.searchParams.set("pdf", "true");
      if (typeof window !== "undefined") {
        window.open(url.toString(), "_blank");
      } else {
        const res = await fetch(url.toString(), { credentials: "include" });
        const blob = await res.blob();
        const buf = Buffer.from(await blob.arrayBuffer());
        const fs = require("fs");
        const path = require("path");
        const tmpPath = path.join(
          require("os").tmpdir(),
          `income-report-${Date.now()}.pdf`
        );
        fs.writeFileSync(tmpPath, buf);
        console.log(`PDF saved to ${tmpPath}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export PDF");
    }
  };

  const totals = useMemo(() => {
    if (!data) return { monthly: 0, advance: 0, deposit: 0, tenants: 0, paid: 0 };
    const monthly = data.monthlySummary.reduce((s, m) => s + m.total, 0);
    const advance = data.advanceSummary.reduce((s, m) => s + m.total, 0);
    const deposit = data.depositSummary.reduce((s, m) => s + m.total, 0);
    const tenants = data.tenantPayments.length;
    const paid = data.tenantPayments.filter((p) => p.status === "Paid").length;
    return { monthly, advance, deposit, tenants, paid };
  }, [data]);

  return (
    <div className="space-y-6">
      {!embedded ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Income Reports</h1>
            <p className="text-sm text-muted-foreground">
              Monthly income, advance payments, and security deposit summaries with downloadable PDF.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={load}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : "Refresh"}
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-[0.7rem] text-muted-foreground">Monthly Income</p>
            <p className="text-xl font-semibold text-slate-900">{formatPhp(totals.monthly)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-[0.7rem] text-muted-foreground">Advance Payments</p>
            <p className="text-xl font-semibold text-slate-900">{formatPhp(totals.advance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-[0.7rem] text-muted-foreground">Security Deposits</p>
            <p className="text-xl font-semibold text-slate-900">{formatPhp(totals.deposit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-[0.7rem] text-muted-foreground">Rent Paid</p>
            <p className="text-xl font-semibold text-slate-900">{totals.paid} / {totals.tenants}</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly summary table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Monthly Income Summary</h2>
              <p className="text-[0.7rem] text-muted-foreground">
                Summary of all income sources for each month.
              </p>
            </div>
            <div className="flex gap-2">
              <label className="relative flex items-center">
                <CalendarIcon className="absolute left-2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="month"
                  className="h-8 w-40 rounded-md border border-gray-300 bg-muted text-xs text-slate-700 pl-8 pr-2 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </label>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                onClick={exportPdf}
                disabled={loading}
              >
                <Download className="mr-1 h-3 w-3" />
                Download PDF
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Monthly Rent</TableHead>
                  <TableHead className="text-right">Advance</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Paid Tenants</TableHead>
                  <TableHead>Rent Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : !data || data.monthlySummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                      No data available.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.monthlySummary.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell className="font-medium text-slate-800">{formatMonth(m.month)}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatPhp(m.total)}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatPhp(m.advanceTotal)}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatPhp(m.depositTotal)}</TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">{formatPhp(m.total + m.advanceTotal + m.depositTotal)}</TableCell>
                      <TableCell>{m.tenants.join(", ")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[0.65rem]">
                          {m.paid} / {m.count}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tenant payments list */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Tenant Payments</h2>
              <p className="text-[0.7rem] text-muted-foreground">
                Students/tenants who have paid rent this month.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              onClick={exportPdf}
              disabled={loading}
            >
              <Download className="mr-1 h-3 w-3" />
              Download PDF
            </Button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Dorm</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : !data || data.tenantPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                      No payments found for this month.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.tenantPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-slate-800">{p.payerName}</TableCell>
                      <TableCell className="text-slate-700">{p.roomNo}</TableCell>
                      <TableCell className="text-slate-700">{p.dormName}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatPhp(p.amount)}</TableCell>
                      <TableCell className="text-slate-700">{p.method}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[0.65rem]">
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-700 text-[0.7rem]">
                        {p.periodLabel || "—"}
                      </TableCell>
                      <TableCell className="text-slate-700">{p.date}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Advance Payments table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Advance Payments</h2>
              <p className="text-[0.7rem] text-muted-foreground">
                Advance payments received this month: {data?.advanceSummary.length ?? 0} record(s).
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : !data || data.advanceSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      No advance payments found for this month.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.advanceSummary.map((a, i) => (
                    <TableRow key={`adv-${i}`}>
                      <TableCell className="text-slate-700">{formatMonth(a.month)}</TableCell>
                      <TableCell className="font-medium text-slate-800">{a.payer}</TableCell>
                      <TableCell className="text-slate-700">{a.property}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatPhp(a.total)}</TableCell>
                      <TableCell className="text-right text-slate-700">{a.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Security Deposits table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Security Deposits</h2>
              <p className="text-[0.7rem] text-muted-foreground">
                Security deposits received this month: {data?.depositSummary.length ?? 0} record(s).
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : !data || data.depositSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      No security deposits found for this month.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.depositSummary.map((d, i) => (
                    <TableRow key={`dep-${i}`}>
                      <TableCell className="text-slate-700">{formatMonth(d.month)}</TableCell>
                      <TableCell className="font-medium text-slate-800">{d.payer}</TableCell>
                      <TableCell className="text-slate-700">{d.property}</TableCell>
                      <TableCell className="text-right text-slate-700">{formatPhp(d.total)}</TableCell>
                      <TableCell className="text-right text-slate-700">{d.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LandlordIncomeReportsPage() {
  return <LandlordIncomeReportsPanel />;
}
