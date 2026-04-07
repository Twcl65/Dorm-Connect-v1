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
import { Eye, Loader2 } from "lucide-react";

type ReservationStatus =
  | "Active"
  | "Completed"
  | "Cancelled"
  | "Pending";
type PaymentStatus = "Paid" | "Pending" | "Overdue";

type ReservationRow = {
  id: string;
  dormName: string;
  roomNo: string;
  leasePeriod: string;
  reservationStatus: ReservationStatus;
  paymentStatus: PaymentStatus;
  monthlyRent: number;
};

const ROWS_PER_PAGE = 5;

function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const colorClasses =
    status === "Active"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Pending"
        ? "bg-amber-100 text-amber-800"
        : status === "Completed"
          ? "bg-slate-100 text-slate-800"
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

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const colorClasses =
    status === "Paid"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Overdue"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";

  return (
    <Badge
      className={`${colorClasses} rounded-full px-3 py-1 text-xs font-medium`}
      variant="outline"
    >
      {status}
    </Badge>
  );
}

export default function StudentDashboardPage() {
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [activeReservation, setActiveReservation] =
    useState<ReservationRow | null>(null);
  const [latestPayment, setLatestPayment] = useState<{
    amount: number;
    status: string;
    paidAtLabel: string | null;
  } | null>(null);
  const [paymentHint, setPaymentHint] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ReservationStatus | "all">("all");
  const [selectedReservation, setSelectedReservation] =
    useState<ReservationRow | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/overview", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        reservations?: ReservationRow[];
        activeReservation?: ReservationRow | null;
        latestPayment?: typeof latestPayment;
        paymentHint?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setReservations(json.reservations ?? []);
      setActiveReservation(json.activeReservation ?? null);
      setLatestPayment(json.latestPayment ?? null);
      setPaymentHint(json.paymentHint ?? "");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setReservations([]);
      setActiveReservation(null);
      setLatestPayment(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredReservations = useMemo(
    () =>
      reservations.filter((res) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          q.length === 0 ||
          res.id.toLowerCase().includes(q) ||
          res.dormName.toLowerCase().includes(q) ||
          res.roomNo.toLowerCase().includes(q);
        const matchesStatus =
          statusFilter === "all" || res.reservationStatus === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [reservations, search, statusFilter]
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Student Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Track your reservations and payment status.
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

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {loadError}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Active / pending stay
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-700">
            {activeReservation ? (
              <>
                <p className="font-semibold text-slate-900">
                  {activeReservation.dormName} – Room {activeReservation.roomNo}
                </p>
                <p className="text-xs text-muted-foreground">
                  Lease period: {activeReservation.leasePeriod}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  Reservation:{" "}
                  <ReservationStatusBadge
                    status={activeReservation.reservationStatus}
                  />
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                You do not have an active or pending reservation.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Latest payment record
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-700">
            {latestPayment ? (
              <>
                <p>
                  Amount:{" "}
                  <span className="font-semibold text-slate-900">
                    ₱{latestPayment.amount.toLocaleString()}
                  </span>
                </p>
                {latestPayment.paidAtLabel && (
                  <p className="text-xs text-muted-foreground">
                    Paid: {latestPayment.paidAtLabel}
                  </p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  Status:{" "}
                  <span className="font-medium">{latestPayment.status}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No payment records yet.
              </p>
            )}
            {paymentHint && (
              <p className="text-xs text-muted-foreground pt-1">{paymentHint}</p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800">
                Reservation History
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Your past and current dorm reservations.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Search ID, dorm, or room..."
                className="h-8 w-full bg-muted text-xs sm:w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs sm:w-44"
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
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Dorm Name</TableHead>
                <TableHead>Room No.</TableHead>
                <TableHead>Lease Period</TableHead>
                <TableHead>Reservation Status</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead className="text-right pr-4 font-semibold text-slate-600">
                  Action
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
                      : "No reservations yet. Browse dorms to reserve a room."}
                  </TableCell>
                </TableRow>
              )}
              {paginatedReservations.map((res) => (
                <TableRow key={res.id}>
                  <TableCell className="text-xs font-mono text-slate-500">
                    {res.id.slice(0, 8)}…
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-800">
                    {res.dormName}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {res.roomNo}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {res.leasePeriod}
                  </TableCell>
                  <TableCell>
                    <ReservationStatusBadge
                      status={res.reservationStatus}
                    />
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={res.paymentStatus} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end">
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

      {showDetailsDialog && selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Reservation Details
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Summary of this reservation.
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
                  {selectedReservation.dormName} – Room{" "}
                  {selectedReservation.roomNo}
                </p>
                <p className="text-muted-foreground">
                  ID:{" "}
                  <span className="font-mono">{selectedReservation.id}</span>
                </p>
                <p className="text-muted-foreground">
                  Lease: {selectedReservation.leasePeriod}
                </p>
                <p className="text-muted-foreground">
                  Monthly rent: ₱
                  {selectedReservation.monthlyRent.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Status
                </p>
                <div className="flex gap-2 items-center">
                  <span className="text-[0.7rem] text-muted-foreground">
                    Reservation:
                  </span>
                  <ReservationStatusBadge
                    status={selectedReservation.reservationStatus}
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-[0.7rem] text-muted-foreground">
                    Rent payment:
                  </span>
                  <PaymentStatusBadge
                    status={selectedReservation.paymentStatus}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
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
    </div>
  );
}
