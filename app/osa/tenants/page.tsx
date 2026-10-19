"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RotateCw } from "lucide-react";

type Tenant = {
  studentId: string;
  name: string;
  email: string;
  schoolId: string | null;
  course: string | null;
  dormName: string;
  roomNo: string;
  landlordName: string;
  leaseStart: string | null;
  leaseEnd: string | null;
  extensionEnd: string | null;
  extensionStatus: string | null;
  occupancy: string;
  moveOutDate: string | null;
  balanceRemaining: number;
};

export default function OsaTenantsPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<{
    dormName: string;
    leaseStart: string;
    leaseEnd: string;
    balanceRemaining: string;
    status: string;
  }[]>([]);

  const loadAllTenants = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/osa/tenants`, { credentials: "include" });
      const data = (await res.json()) as { tenants?: Tenant[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load tenants");
      setAllTenants(data.tenants ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tenants");
      setAllTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (studentId: string) => {
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/osa/tenants/history?studentId=${studentId}`, { credentials: "include" });
      const json = (await res.json()) as { history?: { dormName: string; leaseStart: string; leaseEnd: string; balanceRemaining: string; status: string }[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load history");
      setHistoryData(json.history ?? []);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openTenantHistory = (t: Tenant) => {
    void loadHistory(t.studentId);
    setSelectedTenant(t);
    setShowHistoryDialog(true);
  };

  useEffect(() => {
    void loadAllTenants();
  }, [loadAllTenants]);

  const filteredTenants = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length === 0) return allTenants;

    return allTenants.filter((t) =>
      t.name.toLowerCase().includes(query) ||
      t.email.toLowerCase().includes(query) ||
      (t.schoolId && t.schoolId.toLowerCase().includes(query)) ||
      t.dormName.toLowerCase().includes(query) ||
      t.roomNo.toLowerCase().includes(query) ||
      t.landlordName.toLowerCase().includes(query)
    );
  }, [allTenants, q]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Tenant monitoring</h2>
        <p className="text-sm text-muted-foreground">
          Search confirmed tenants by name, email, or school ID. For parents and
          school staff locating students.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-end justify-between gap-2">
            <CardTitle className="text-sm">Search</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => void loadAllTenants()}
              disabled={loading}
            >
              <RotateCw className="h-3 w-3" />
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            className="max-w-md h-9 text-sm"
            placeholder="Search by name, email, school ID, dorm, room, or landlord…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading && allTenants.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tenants…
            </div>
          ) : (
            <Table bordered={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Boarding house</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Landlord</TableHead>
                  <TableHead>Stay</TableHead>
                  <TableHead>Lease status</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-xs text-muted-foreground"
                    >
                      {q.trim().length === 0 && allTenants.length === 0
                        ? "No tenants found."
                        : "No matching tenants."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map((t) => (
                    <TableRow
                      key={`${t.studentId}-${t.dormName}-${t.roomNo}`}
                      className="cursor-pointer"
                      onClick={() => openTenantHistory(t)}
                    >
                      <TableCell className="text-sm">
                        <div className="font-medium text-slate-900">{t.name}</div>
                        <div className="text-[0.65rem] text-muted-foreground">
                          {t.email}
                        </div>
                        <div className="text-[0.65rem]">
                          ID: {t.schoolId ?? "—"} · {t.course ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{t.dormName}</TableCell>
                      <TableCell className="text-xs font-mono">{t.roomNo}</TableCell>
                      <TableCell className="text-xs">{t.landlordName}</TableCell>
                      <TableCell className="text-xs">
                        {t.leaseStart ? `${t.leaseStart} → ` : ""}
                        {t.leaseEnd ?? "—"}
                        {t.extensionEnd ? ` · (extend to ${t.extensionEnd})` : ""}
                      </TableCell>
                      <TableCell className="text-xs">
                        {(t.extensionStatus ?? "").toLowerCase() === "approved" && t.extensionEnd
                          ? "Extended"
                          : t.moveOutDate
                            ? "Terminated"
                            : "Active"}
                      </TableCell>
                      <TableCell className="text-xs">{t.occupancy}</TableCell>
                      <TableCell
                        className="text-right font-mono"
                        style={{ textAlign: "right" }}
                      >
                        ₱{t.balanceRemaining.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showHistoryDialog && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6">
          <Card className="w-full max-w-2xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    {selectedTenant.name} — Dorm History
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Reserved room history, lease periods, and balance status.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowHistoryDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-3 text-xs text-slate-800">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-[0.75rem] font-semibold text-slate-900">
                    {selectedTenant.dormName}
                  </p>
                  <p className="text-[0.7rem] text-muted-foreground">
                    Room {selectedTenant.roomNo} · {selectedTenant.landlordName}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[0.75rem] font-semibold text-slate-900">
                    {selectedTenant.occupancy}
                  </p>
                  <p className="text-[0.7rem] text-muted-foreground">
                    Lease: {selectedTenant.leaseStart ?? "—"} →{" "}
                    {selectedTenant.leaseEnd ?? "—"}
                    {selectedTenant.extensionEnd
                      ? ` · extend to ${selectedTenant.extensionEnd}`
                      : ""}
                    {selectedTenant.moveOutDate
                      ? ` · moved out ${selectedTenant.moveOutDate}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[0.7rem] font-semibold text-slate-900">
                  Reservation history
                </p>
                {historyLoading ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    Loading history…
                  </p>
                ) : historyData.length === 0 ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    No historical records found.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {historyData.map((h, i) => (
                      <div
                        key={i}
                        className="rounded bg-white px-2 py-1 text-xs"
                      >
                        <p className="font-medium text-slate-900">{h.dormName}</p>
                        <p className="text-[0.65rem] text-slate-500">
                          {h.leaseStart} → {h.leaseEnd}
                        </p>
                        <p className="text-[0.65rem] text-slate-600">
                          Balance remaining: {h.balanceRemaining || "0"}
                        </p>
                        <p className="text-[0.65rem] text-slate-500">
                          Status: {h.status}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {historyError && (
                <p className="text-xs text-red-600">{historyError}</p>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowHistoryDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
