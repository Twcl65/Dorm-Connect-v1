"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Check, Loader2, AlertTriangle, PauseCircle, X } from "lucide-react";
import { cn } from "@/components/ui/utils";

type ReservationStatus = "Confirmed" | "Pending" | "Cancelled" | "MoveOut" | "TerminatePending";
type TabView = "reservations" | "history";

type UnpaidElsewhere = {
  dormName: string;
  roomNo: string;
  leasePeriod: string;
  balanceRemaining: number;
  rentPaymentStatus: string;
};

type Reservation = {
  id: string;
  source?: "manual" | "student";
  roomNo: string;
  name: string;
  leasePeriod: string;
  reservationStatus: ReservationStatus;
  dormName: string;
  email?: string;
  contact?: string;
  rentPaymentStatus?: string;
  notes?: string;
  hasUnpaidElsewhere?: boolean;
  unpaidElsewhere?: UnpaidElsewhere[];
  leaseEndDate?: string;
  moveOutDate?: string;
  terminateDate?: string;
  leaseExtension?: {
    status: "Pending" | "Approved" | "Rejected";
    requestedEnd: string;
  } | null;
};

type HistoryRow = {
  id: string;
  reservationId: string;
  tenantName: string;
  roomNo: string;
  propertyName: string;
  leaseStart: string;
  leaseEnd: string;
  moveOutDate: string;
  status: string;
  rentPaymentStatus: string;
  advanceAmount: number;
  depositAmount: number;
  balanceRemaining: number;
  endedBy: string;
  endedReason: string;
  endedAt: string;
};

const ROWS_PER_PAGE = 5;

function UnpaidElsewhereAlert({
  items,
}: {
  items: UnpaidElsewhere[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[0.7rem] text-amber-950">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">
            Unpaid balance at another boarding house
          </p>
          <p>
            This applicant still has outstanding dues elsewhere. You may hold
            this application until balances are settled.
          </p>
          <ul className="list-disc space-y-0.5 pl-4">
            {items.map((u, i) => (
              <li key={`${u.dormName}-${i}`}>
                {u.dormName} · Room {u.roomNo} · {u.leasePeriod}
                {u.balanceRemaining > 0 &&
                  ` · ₱${u.balanceRemaining.toLocaleString()} remaining`}
                {u.rentPaymentStatus !== "Paid" &&
                  ` · Rent: ${u.rentPaymentStatus}`}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const colorClasses =
    status === "Confirmed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Pending"
        ? "bg-amber-100 text-amber-800"
        : status === "MoveOut"
          ? "bg-slate-100 text-slate-700"
          : status === "TerminatePending"
            ? "bg-sky-100 text-sky-800"
            : "bg-red-100 text-red-800";

  return (
    <Badge
      className={`${colorClasses} inline-flex min-w-[5.5rem] justify-center rounded-full px-3 py-1 text-xs font-medium`}
      variant="outline"
    >
      {status === "TerminatePending" ? "Terminate Requested" : status}
    </Badge>
  );
}

export type LandlordReservationsPanelProps = {
  embedded?: boolean;
};

export function LandlordReservationsPanel({
  embedded = false,
}: LandlordReservationsPanelProps = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ReservationStatus | "all">("all");
  const [reservationsData, setReservationsData] = useState<Reservation[]>([]);
  const [historyData, setHistoryData] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>("reservations");
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    unpaidElsewhere: 0,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const loadData = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/landlord/reservations", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        reservations?: Reservation[];
        stats?: typeof stats;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      const reservations = (json.reservations ?? []).filter(
        (r) => r.reservationStatus !== "MoveOut"
      );
      setReservationsData(reservations);
      if (json.stats) setStats(json.stats);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setReservationsData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/landlord/reservations/history", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        history?: HistoryRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load history");
      setHistoryData(json.history ?? []);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Failed to load history");
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === "history") {
      void loadHistory();
    }
  }, [activeTab, loadHistory]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Reservations",
        value: String(stats.total),
        badge: "All",
        badgeVariant: "secondary" as const,
      },
      {
        label: "Confirmed",
        value: String(stats.confirmed),
        badge: "Confirmed",
        badgeVariant: "success" as const,
      },
      {
        label: "Pending",
        value: String(stats.pending),
        badge: "Pending",
        badgeVariant: "warning" as const,
      },
      {
        label: "Cancelled",
        value: String(stats.cancelled),
        badge: "Cancelled",
        badgeVariant: "destructive" as const,
      },
      {
        label: "Unpaid at other BH",
        value: String(stats.unpaidElsewhere ?? 0),
        badge: "Review",
        badgeVariant: "warning" as const,
      },
    ],
    [stats]
  );

  const filteredReservations = useMemo(
    () =>
      reservationsData.filter((res) => {
        const src =
          res.source === "student" ? "student app" : "manual entry";
        const matchesSearch =
          search.trim().length === 0 ||
          res.name.toLowerCase().includes(search.toLowerCase()) ||
          res.roomNo.toLowerCase().includes(search.toLowerCase()) ||
          res.id.toLowerCase().includes(search.toLowerCase()) ||
          src.includes(search.toLowerCase());
        const matchesStatus =
          statusFilter === "all" || res.reservationStatus === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [reservationsData, search, statusFilter]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredReservations.length / ROWS_PER_PAGE)
  );

  const paginatedReservations = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return filteredReservations.slice(start, end);
  }, [filteredReservations, page]);

  const from =
    filteredReservations.length === 0
      ? 0
      : (page - 1) * ROWS_PER_PAGE + 1;
  const to =
    filteredReservations.length === 0
      ? 0
      : Math.min(page * ROWS_PER_PAGE, filteredReservations.length);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(1, totalPages)));
  }, [totalPages]);

  const holdApplication = async (res: Reservation) => {
    if (res.source !== "student") return;
    setSaving(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/landlord/student-reservations/${res.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holdApplication: true }),
        }
      );
      const j = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(j.error ?? "Failed to hold application");
      setShowDetailsDialog(false);
      setShowConfirmDialog(false);
      await loadData();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to hold application");
    } finally {
      setSaving(false);
    }
  };

  const decideLeaseExtension = async (
    res: Reservation,
    decision: "Approved" | "Rejected"
  ) => {
    if (res.source !== "student") return;
    setSaving(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/landlord/student-reservations/${res.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leaseExtension: decision }),
        }
      );
      const j = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(j.error ?? "Failed to update extension");
      setShowDetailsDialog(false);
      await loadData();
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to update extension"
      );
    } finally {
      setSaving(false);
    }
  };

  const approveMoveOut = async (res: Reservation) => {
    if (res.source !== "student") return;
    setSaving(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/landlord/student-reservations/${res.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moveOut: true,
            moveOutDate: res.moveOutDate ?? res.leaseEndDate ?? undefined,
            notes: "Approved by landlord",
          }),
        }
      );
      const j = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(j.error ?? "Failed to approve move-out");
      setShowDetailsDialog(false);
      await loadData();
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to approve move-out"
      );
    } finally {
      setSaving(false);
    }
  };

  const disapproveTerminate = async (res: Reservation) => {
    if (res.source !== "student") return;
    setSaving(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/landlord/student-reservations/${res.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Confirmed",
            notes: "Terminate request disapproved",
          }),
        }
      );
      const j = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(j.error ?? "Failed to disapprove terminate request");
      setShowDetailsDialog(false);
      await loadData();
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to disapprove terminate request"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        {!embedded ? (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Reservations
            </h1>
            <p className="text-sm text-muted-foreground">
              Review student applications and flag tenants who still owe rent at
              another boarding house before confirming.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Review student applications and flag tenants who still owe rent at
            another boarding house before confirming.
          </p>
        )}
        <div className="inline-flex rounded-md border border-gray-300 bg-white p-1">
          <Button
            type="button"
            size="sm"
            variant={activeTab === "reservations" ? "default" : "ghost"}
            className="h-7 px-3 text-xs"
            onClick={() => setActiveTab("reservations")}
          >
            Reservations
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === "history" ? "default" : "ghost"}
            className="h-7 px-3 text-xs"
            onClick={() => setActiveTab("history")}
          >
            History
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            if (activeTab === "history") {
              void loadHistory();
            } else {
              void loadData();
            }
          }}
          disabled={activeTab === "history" ? historyLoading : loading}
        >
          {(activeTab === "history" ? historyLoading : loading) ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Loading…
            </>
          ) : (
            "Refresh"
          )}
        </Button>
      </div>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {loadError}
        </div>
      )}

      {activeTab === "history" && historyError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {historyError}
        </div>
      )}

      {activeTab === "reservations" ? (
        <>
          <Card className="border-sky-200 bg-sky-50/50 shadow-sm">
            <CardHeader className="pb-3 border-b border-sky-100 bg-sky-50">
              <CardTitle className="text-base font-semibold text-sky-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-sky-600" />
                Pending Lease Extensions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {!reservationsData.some((r) => r.leaseExtension?.status === "Pending") ? (
                <div className="text-sm text-sky-800 py-2">
                  No pending lease extension requests from students.
                </div>
              ) : (
                <div className="space-y-4">
                  {reservationsData
                    .filter((r) => r.leaseExtension?.status === "Pending")
                    .map((res) => (
                      <div
                        key={res.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-lg border border-sky-200 shadow-sm"
                      >
                        <div>
                          <p className="text-sm font-semibold text-sky-900">
                            {res.name}
                          </p>
                          <p className="text-xs text-sky-700">
                            {res.dormName} · Room {res.roomNo}
                          </p>
                          <p className="text-xs text-sky-700">
                            Requested end:{" "}
                            {new Date(
                              `${res.leaseExtension!.requestedEnd}T12:00:00`
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-8 px-3 text-xs bg-sky-600 text-white hover:bg-sky-700"
                            disabled={saving}
                            onClick={() =>
                              void decideLeaseExtension(res, "Approved")
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-xs border-red-300 text-red-700 hover:bg-red-50"
                            disabled={saving}
                            onClick={() =>
                              void decideLeaseExtension(res, "Rejected")
                            }
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-300 bg-white">
            <CardHeader className="pb-3 border-b bg-muted/40">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Reservations
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Reservation status: pending, confirmed, or cancelled.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    placeholder="Search ID, room, or name..."
                    className="h-8 w-full bg-muted text-xs sm:w-56"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select
                    className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs sm:w-40"
                    value={statusFilter}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setStatusFilter(
                        e.target.value === "all"
                          ? "all"
                          : (e.target.value as ReservationStatus)
                      )
                    }
                  >
                    <option value="all">All statuses</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Pending">Pending</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="TerminatePending">Terminate Requested</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <Table bordered={false}>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Room No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Lease Period</TableHead>
                    <TableHead>Terminate Lease</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="pr-4 font-semibold text-slate-600">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedReservations.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        {loading
                          ? "Loading…"
                          : "No reservations yet."}
                      </TableCell>
                    </TableRow>
                  )}
                  {paginatedReservations.map((res) => (
                    <TableRow
                      key={`${res.source ?? "manual"}-${res.id}`}
                      className={cn(
                        res.hasUnpaidElsewhere &&
                          res.reservationStatus === "Pending" &&
                          "bg-amber-50/70"
                      )}
                    >
                      <TableCell className="text-xs font-mono text-slate-500">
                        {res.id.slice(0, 8)}…
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {res.source === "student" ? "Student app" : "Manual"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {res.roomNo}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-800">
                        {res.name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {res.leasePeriod}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {res.reservationStatus === "TerminatePending" && res.terminateDate
                          ? `Requesting (${new Date(`${res.terminateDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })})`
                          : res.reservationStatus === "TerminatePending"
                            ? "Requesting"
                            : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <ReservationStatusBadge
                            status={res.reservationStatus}
                          />
                          {res.hasUnpaidElsewhere &&
                            res.reservationStatus === "Pending" && (
                              <Badge
                                variant="outline"
                                className="rounded-full bg-amber-100 px-2 py-0 text-[0.65rem] font-semibold text-amber-900 ring-1 ring-amber-300"
                              >
                                Unpaid at other BH
                              </Badge>
                            )}
                          {res.leaseExtension?.status === "Pending" && (
                            <Badge
                              variant="outline"
                              className="rounded-full bg-sky-100 px-2 py-0 text-[0.65rem] font-semibold text-sky-900 ring-1 ring-sky-300"
                            >
                              Extension request
                            </Badge>
                          )}
                          {res.source === "student" &&
                            res.rentPaymentStatus && (
                              <span className="text-[0.65rem] leading-snug text-muted-foreground">
                                {res.rentPaymentStatus}
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex flex-nowrap items-center justify-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                            onClick={() => {
                              setSelectedReservation(res);
                              setShowDetailsDialog(true);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                            View Details
                          </Button>
                          {res.reservationStatus === "Pending" && (
                            <Button
                              size="sm"
                              className="h-7 px-2 text-[0.7rem] flex items-center gap-1 bg-emerald-500 text-white hover:bg-emerald-600"
                              onClick={() => {
                                setSelectedReservation(res);
                                setShowConfirmDialog(true);
                              }}
                            >
                              <Check className="h-3 w-3" />
                              Confirm reservation
                            </Button>
                          )}
                          {res.reservationStatus === "TerminatePending" && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 px-2 text-[0.7rem] flex items-center gap-1 bg-emerald-500 text-white hover:bg-emerald-600"
                                disabled={saving}
                                onClick={() => approveMoveOut(res)}
                              >
                                <Check className="h-3 w-3" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-red-300 text-red-700 hover:bg-red-50"
                                disabled={saving}
                                onClick={() => disapproveTerminate(res)}
                              >
                                <X className="h-3 w-3" />
                                Disapprove
                              </Button>
                            </>
                          )}
                          {res.leaseExtension?.status === "Pending" && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 px-2 text-[0.7rem] flex items-center gap-1 bg-sky-600 text-white hover:bg-sky-700"
                                disabled={saving}
                                onClick={() =>
                                  void decideLeaseExtension(res, "Approved")
                                }
                              >
                                <Check className="h-3 w-3" />
                                Approve extension
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-red-300 text-red-700 hover:bg-red-50"
                                disabled={saving}
                                onClick={() =>
                                  void decideLeaseExtension(res, "Rejected")
                                }
                              >
                                <X className="h-3 w-3" />
                                Decline
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-2 border-t px-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[0.7rem] text-muted-foreground">
                  Showing {from}–{to} of {filteredReservations.length} reservations
                </p>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[0.7rem]"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1 text-[0.7rem]">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (p) => (
                        <Button
                          key={p}
                          variant={p === page ? "default" : "outline"}
                          size="sm"
                          className="h-7 w-7 px-0 text-[0.7rem]"
                          onClick={() => handlePageChange(p)}
                        >
                          {p}
                        </Button>
                      )
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[0.7rem]"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border border-gray-300 bg-white">
          <CardHeader className="pb-3 border-b bg-muted/40">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Move-out history
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Archived reservations with move-out or end-lease records.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <Table bordered={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Reservation</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Lease</TableHead>
                  <TableHead>Move-out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4">Payments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyData.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-xs text-muted-foreground"
                    >
                      {historyLoading ? "Loading…" : "No history yet."}
                    </TableCell>
                  </TableRow>
                )}
                {historyData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs font-mono text-slate-500">
                      {row.reservationId.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {row.tenantName}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {row.propertyName} · {row.roomNo}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {row.leaseStart} → {row.leaseEnd}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {row.moveOutDate || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className="rounded-full bg-slate-100 px-2 py-1 text-[0.65rem] font-medium text-slate-800"
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4 text-xs text-slate-700">
                      <div className="space-y-1">
                        <p>Rent: {row.rentPaymentStatus || "—"}</p>
                        <p>
                          Advance: {formatMoney(row.advanceAmount)} · Deposit:{" "}
                          {formatMoney(row.depositAmount)}
                        </p>
                        <p>Balance: {formatMoney(row.balanceRemaining)}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* View reservation details dialog */}
      {showDetailsDialog && selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Reservation Details
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Guest, room, lease, and reservation status.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {selectedReservation.name}
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Reservation ID:{" "}
                  <span className="font-mono">{selectedReservation.id}</span>
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Dorm / Room:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedReservation.dormName} – Room{" "}
                    {selectedReservation.roomNo}
                  </span>
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Lease Period:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedReservation.leasePeriod}
                  </span>
                </p>
                {selectedReservation.leaseExtension?.status === "Pending" && (
                  <p className="text-[0.7rem] rounded border border-sky-200 bg-sky-50 px-2 py-1.5 text-sky-950">
                    <span className="font-semibold">Lease extension request: </span>
                    student asked to stay through{" "}
                    {new Date(
                      `${selectedReservation.leaseExtension.requestedEnd}T12:00:00`
                    ).toLocaleDateString()}
                    . Approve to add extra months to the rent schedule.
                  </p>
                )}
                {selectedReservation.email && (
                  <p className="text-[0.7rem] text-muted-foreground">
                    Email:{" "}
                    <span className="font-medium text-slate-900">
                      {selectedReservation.email}
                    </span>
                  </p>
                )}
                {selectedReservation.contact && (
                  <p className="text-[0.7rem] text-muted-foreground">
                    Contact:{" "}
                    <span className="font-medium text-slate-900">
                      {selectedReservation.contact}
                    </span>
                  </p>
                )}
                {selectedReservation.source === "student" &&
                  selectedReservation.rentPaymentStatus && (
                    <p className="text-[0.7rem] text-muted-foreground">
                      Rent (monthly schedule):{" "}
                      <span className="font-medium text-slate-900">
                        {selectedReservation.rentPaymentStatus}
                      </span>
                    </p>
                  )}
              </div>

              {selectedReservation.unpaidElsewhere &&
                selectedReservation.unpaidElsewhere.length > 0 && (
                  <UnpaidElsewhereAlert
                    items={selectedReservation.unpaidElsewhere}
                  />
                )}

              {selectedReservation.notes && (
                <p className="text-[0.7rem] text-muted-foreground rounded border bg-slate-50 px-2 py-1.5">
                  <span className="font-semibold text-slate-800">Note: </span>
                  {selectedReservation.notes}
                </p>
              )}

              <div className="space-y-1">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Reservation status
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  <ReservationStatusBadge
                    status={selectedReservation.reservationStatus}
                  />
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                {selectedReservation.reservationStatus === "Pending" &&
                  selectedReservation.source === "student" &&
                  selectedReservation.hasUnpaidElsewhere && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs border-amber-400 text-amber-800 hover:bg-amber-50"
                      disabled={saving}
                      onClick={() => void holdApplication(selectedReservation)}
                    >
                      <PauseCircle className="mr-1 h-3 w-3" />
                      {saving ? "Holding…" : "Hold application"}
                    </Button>
                  )}
                {selectedReservation.reservationStatus === "Pending" && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-3 text-xs bg-emerald-500 text-white hover:bg-emerald-600"
                    disabled={selectedReservation.hasUnpaidElsewhere === true}
                    onClick={() => {
                      setShowDetailsDialog(false);
                      setShowConfirmDialog(true);
                    }}
                  >
                    Confirm reservation
                  </Button>
                )}
                {selectedReservation.leaseExtension?.status === "Pending" && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs bg-sky-600 text-white hover:bg-sky-700"
                      disabled={saving}
                      onClick={() =>
                        void decideLeaseExtension(
                          selectedReservation,
                          "Approved"
                        )
                      }
                    >
                      Approve extension
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs border-red-300 text-red-700 hover:bg-red-50"
                      disabled={saving}
                      onClick={() =>
                        void decideLeaseExtension(
                          selectedReservation,
                          "Rejected"
                        )
                      }
                    >
                      Decline extension
                    </Button>
                  </>
                )}
                {selectedReservation.source === "student" &&
                  selectedReservation.reservationStatus === "Confirmed" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs border-red-300 text-red-700 hover:bg-red-50"
                      disabled={saving}
                      onClick={() => void approveMoveOut(selectedReservation)}
                    >
                      Approve move-out
                    </Button>
                  )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirm reservation dialog */}
      {showConfirmDialog && selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-lg border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Confirm reservation?
                  </CardTitle>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <p className="text-[0.75rem] text-slate-800">
                You are about to confirm this reservation. The status will
                change from Pending to Confirmed.
              </p>
              <div className="space-y-1 text-[0.75rem]">
                <p>
                  <span className="font-semibold">Guest:</span>{" "}
                  {selectedReservation.name}
                </p>
                <p>
                  <span className="font-semibold">Dorm / Room:</span>{" "}
                  {selectedReservation.dormName} – Room{" "}
                  {selectedReservation.roomNo}
                </p>
                <p>
                  <span className="font-semibold">Lease period:</span>{" "}
                  {selectedReservation.leasePeriod}
                </p>
              </div>
              {selectedReservation.unpaidElsewhere &&
                selectedReservation.unpaidElsewhere.length > 0 && (
                  <UnpaidElsewhereAlert
                    items={selectedReservation.unpaidElsewhere}
                  />
                )}

              <div className="space-y-1 text-[0.75rem]">
                <p className="font-semibold">After you confirm:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>The reservation is marked Confirmed.</li>
                  <li>
                    For student app bookings, the room is marked occupied when
                    appropriate.
                  </li>
                </ul>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-3">
                {selectedReservation.source === "student" &&
                  selectedReservation.hasUnpaidElsewhere && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs border-amber-400 text-amber-800 hover:bg-amber-50"
                      disabled={saving}
                      onClick={() => void holdApplication(selectedReservation)}
                    >
                      <PauseCircle className="mr-1 h-3 w-3" />
                      Hold application
                    </Button>
                  )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={saving}
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={
                    saving || selectedReservation.hasUnpaidElsewhere === true
                  }
                  onClick={async () => {
                    if (!selectedReservation) return;
                    setSaving(true);
                    try {
                      const url =
                        selectedReservation.source === "student"
                          ? `/api/landlord/student-reservations/${selectedReservation.id}`
                          : `/api/landlord/reservations/${selectedReservation.id}`;
                      const res = await fetch(url, {
                        method: "PATCH",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "Confirmed" }),
                      });
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setShowConfirmDialog(false);
                      await loadData();
                    } catch (e) {
                      setLoadError(
                        e instanceof Error ? e.message : "Failed to confirm"
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving…" : "Confirm"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function formatMoney(value?: number) {
  if (value == null || Number.isNaN(value)) return "—";
  return `₱${Number(value).toLocaleString()}`;
}
