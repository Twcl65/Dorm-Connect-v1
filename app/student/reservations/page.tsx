"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PenSquare, Eye, Loader2 } from "lucide-react";
import { Input as FileInput } from "@/components/ui/input";
import { uploadDormConnectFile } from "@/lib/upload-file-client";

type ReservationStatus = "Pending" | "Approved" | "Cancelled";
type PaymentMethod = "gcash" | "bank" | "card";

const ROWS_PER_PAGE = 5;

type Reservation = {
  id: string;
  dorm: string;
  room: string;
  status: ReservationStatus;
  date: string;
  moveInDate: string;
  leaseMonths: number;
  monthlyRent: number;
  location: string;
  landlord: string;
  distance: string;
  documentType: string;
  amenities: string[];
  images: string[];
  leasePeriod?: string;
};

function StatusBadge({ status }: { status: ReservationStatus }) {
  const colorClasses =
    status === "Approved"
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

export default function StudentReservationsPage() {
  const [reservationsData, setReservationsData] = useState<Reservation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ReservationStatus | "all">("all");
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("gcash");
  const [showGcashPaymentSection, setShowGcashPaymentSection] =
    useState(false);
  /** Proof image/PDF for GCash or bank transfer. */
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/reservations", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        reservations?: Reservation[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setReservationsData(json.reservations ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setReservationsData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredReservations = useMemo(
    () =>
      reservationsData.filter((res) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          q.length === 0 ||
          res.id.toLowerCase().includes(q) ||
          res.dorm.toLowerCase().includes(q) ||
          res.room.toLowerCase().includes(q);
        const matchesStatus =
          statusFilter === "all" || res.status === statusFilter;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            My Reservations
          </h1>
          <p className="text-sm text-muted-foreground">
            View the status and details of your dorm reservations.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => void loadData()}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {loadError}
        </div>
      )}

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800">
                Reservations
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Current and past reservation requests.
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
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
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
                <TableHead>Date Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-4 font-semibold text-slate-600">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedReservations.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    {loading
                      ? "Loading…"
                      : "No reservations yet. Browse dorms to create one."}
                  </TableCell>
                </TableRow>
              )}
              {paginatedReservations.map((res) => (
                <TableRow key={res.id}>
                  <TableCell className="text-xs font-mono text-slate-500">
                    {res.id.slice(0, 8)}…
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-800">
                    {res.dorm}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {res.room}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {res.date}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={res.status} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-2">
                      {res.status === "Pending" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2 text-[0.7rem] flex items-center gap-1"
                          onClick={() => {
                            setSelectedReservation(res);
                            setShowEditDialog(true);
                          }}
                        >
                          <PenSquare className="h-3 w-3" />
                          Cancel
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                        onClick={() => {
                          setSelectedReservation(res);
                          setPaymentMethod("gcash");
                          setShowGcashPaymentSection(false);
                          setPaymentProofFile(null);
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

      {/* Edit reservation dialog */}
      {showEditDialog && selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Edit Reservation
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Review your reservation details or cancel this request.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowEditDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-sm text-slate-700">
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-900">
                  {selectedReservation.dorm} – Room {selectedReservation.room}
                </p>
                <p className="text-muted-foreground">
                  Reservation ID:{" "}
                  <span className="font-mono">
                    {selectedReservation.id}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Location: {selectedReservation.location}
                </p>
                <p className="text-muted-foreground">
                  Move-in date:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedReservation.moveInDate}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Lease period:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedReservation.leaseMonths} months
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Monthly rent:{" "}
                  <span className="font-semibold text-slate-900">
                    ₱{selectedReservation.monthlyRent.toLocaleString()}
                  </span>
                </p>
              </div>

              <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-800">Amenities</p>
                {selectedReservation.amenities.length === 0 ? (
                  <p className="text-[0.7rem] text-muted-foreground">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedReservation.amenities.map((amenity) => (
                      <Badge
                        key={amenity}
                        variant="muted"
                        className="text-[0.7rem]"
                      >
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[0.7rem] text-muted-foreground">
                If you cancel this reservation, the dorm landlord will be
                notified and this entry will be marked as{" "}
                <span className="font-semibold">Cancelled</span> in your
                history.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowEditDialog(false)}
                >
                  Keep Reservation
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={saving}
                  onClick={async () => {
                    if (!selectedReservation) return;
                    setSaving(true);
                    try {
                      const res = await fetch(
                        `/api/student/reservations/${selectedReservation.id}`,
                        {
                          method: "PATCH",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "Cancelled" }),
                        }
                      );
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setShowEditDialog(false);
                      await loadData();
                    } catch (e) {
                      setLoadError(
                        e instanceof Error ? e.message : "Failed to cancel"
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving…" : "Cancel Reservation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View details / payment dialog */}
      {showDetailsDialog && selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-4xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Reservation Details
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Full information about your reservation and payment options.
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
            <CardContent className="space-y-4 pt-3 text-sm text-slate-700">
              <div className="grid gap-4 md:grid-cols-[2fr,1.3fr]">
                <div className="space-y-2">
                  <div className="h-40 w-full overflow-hidden rounded-md bg-slate-200">
                    <img
                      src={selectedReservation.images[0]}
                      alt={selectedReservation.dorm}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-slate-900">
                      {selectedReservation.dorm} – Room{" "}
                      {selectedReservation.room}
                    </p>
                    <p className="text-muted-foreground">
                      Reservation ID:{" "}
                      <span className="font-mono">
                        {selectedReservation.id}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Location: {selectedReservation.location}
                    </p>
                    <p className="text-muted-foreground">
                      Distance: {selectedReservation.distance}
                    </p>
                    <p className="text-muted-foreground">
                      Move-in date:{" "}
                      <span className="font-medium text-slate-900">
                        {selectedReservation.moveInDate}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Lease period:{" "}
                      <span className="font-medium text-slate-900">
                        {selectedReservation.leaseMonths} months
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Monthly rent:{" "}
                      <span className="font-semibold text-slate-900">
                        ₱{selectedReservation.monthlyRent.toLocaleString()}
                      </span>
                    </p>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-slate-800">Amenities</p>
                    {selectedReservation.amenities.length === 0 ? (
                      <p className="text-[0.7rem] text-muted-foreground">—</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedReservation.amenities.map((amenity) => (
                          <Badge
                            key={amenity}
                            variant="muted"
                            className="text-[0.7rem]"
                          >
                            {amenity}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-center text-[0.8rem] font-semibold text-slate-900">
                      Rental Terms Summary
                    </p>
                    <div className="mt-1 space-y-1">
                      <p>
                        <span className="font-semibold">Monthly Rent:</span>{" "}
                        ₱{selectedReservation.monthlyRent.toLocaleString()}
                      </p>
                      <p>
                        <span className="font-semibold">
                          Advance Payment (1 Month):
                        </span>{" "}
                        ₱{selectedReservation.monthlyRent.toLocaleString()}
                      </p>
                      <p>
                        <span className="font-semibold">
                          Security Deposit (1 Month):
                        </span>{" "}
                        ₱{selectedReservation.monthlyRent.toLocaleString()}
                      </p>
                    </div>
                    <hr className="my-2 border-slate-200" />
                    <ul className="space-y-1 text-[0.7rem] text-slate-700">
                      <li>
                        <span className="font-semibold">Advance</span> =
                        Applied to your first month&apos;s rent.
                      </li>
                      <li>
                        <span className="font-semibold">Security deposit</span>{" "}
                        = Refundable at end of lease (if no damages and all
                        dues are settled).
                      </li>
                      <li>
                        Utilities (electricity, water, internet) may be billed
                        separately depending on usage and dorm policy.
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[0.8rem] font-semibold text-slate-900">
                      Payment Information
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Total initial amount to pay (first month + advance +
                      deposit):
                    </p>
                    <p className="text-[0.9rem] font-semibold text-slate-900">
                      ₱
                      {(selectedReservation.monthlyRent * 3).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    setShowDetailsDialog(false);
                    setPaymentMethod("gcash");
                    setShowGcashPaymentSection(false);
                    setPaymentProofFile(null);
                    setShowPaymentDialog(true);
                  }}
                >
                  Pay Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment dialog */}
      {showPaymentDialog && selectedReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Pay Reservation
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Choose your payment method and upload proof of payment.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => {
                    setShowPaymentDialog(false);
                    setShowGcashPaymentSection(false);
                    setPaymentProofFile(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-3 text-xs text-slate-800">
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">
                  {selectedReservation.dorm} – Room {selectedReservation.room}
                </p>
                <p className="text-muted-foreground">
                  Total to pay now (first month + advance + deposit):{" "}
                  <span className="font-semibold text-slate-900">
                    ₱
                    {(
                      selectedReservation.monthlyRent * 3
                    ).toLocaleString()}
                  </span>
                </p>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="payment-method-dialog"
                  className="text-[0.75rem] font-medium text-slate-800"
                >
                  Payment method
                </label>
                <select
                  id="payment-method-dialog"
                  className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={paymentMethod}
                  onChange={(e) => {
                    const value = e.target.value as PaymentMethod;
                    setPaymentMethod(value);
                    setShowGcashPaymentSection(false);
                    setPaymentProofFile(null);
                  }}
                >
                  <option value="gcash">GCash</option>
                  <option value="bank">Bank transfer</option>
                  <option value="card">Credit / Debit card</option>
                </select>
              </div>

              {paymentMethod === "gcash" && (
                <div className="space-y-2 rounded-md border border-sky-100 bg-sky-50 px-3 py-2">
                  <p className="text-[0.75rem] font-semibold text-slate-900">
                    Pay with GCash
                  </p>
                  {!showGcashPaymentSection ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-3 text-[0.7rem] bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => setShowGcashPaymentSection(true)}
                    >
                      Show GCash Details
                    </Button>
                  ) : (
                    <div className="space-y-2 text-[0.7rem] text-slate-800">
                      <p>
                        Landlord:{" "}
                        <span className="font-semibold">
                          {selectedReservation.landlord}
                        </span>
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="h-24 w-24 overflow-hidden rounded-md bg-white shadow-sm">
                          <img
                            src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=GCASH-PAYMENT"
                            alt="GCash QR code"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <p className="flex-1 text-[0.7rem] text-slate-700">
                          Scan this QR code using your GCash app to pay the
                          total amount. After payment, upload a screenshot of
                          your receipt for the landlord to review.
                        </p>
                      </div>
                      <div className="space-y-1 pt-1">
                        <label
                          htmlFor="gcash-proof-dialog"
                          className="text-[0.7rem] font-medium text-slate-800"
                        >
                          Upload payment screenshot
                        </label>
                        <FileInput
                          id="gcash-proof-dialog"
                          type="file"
                          accept="image/*,application/pdf"
                          className="h-8 cursor-pointer text-[0.7rem]"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setPaymentProofFile(file);
                          }}
                        />
                        {paymentProofFile && (
                          <p className="text-[0.7rem] text-muted-foreground">
                            Selected file: {paymentProofFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === "bank" && (
                <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[0.7rem] text-slate-800">
                  <p className="font-semibold text-slate-900">
                    Bank transfer details
                  </p>
                  <p>Account name: {selectedReservation.landlord}</p>
                  <p>Bank: Sample Bank</p>
                  <p>Account number: 0000-0000-0000</p>
                  <div className="space-y-1 pt-1">
                    <label
                      htmlFor="bank-proof-dialog"
                      className="text-[0.7rem] font-medium text-slate-800"
                    >
                      Upload transfer receipt
                    </label>
                    <FileInput
                      id="bank-proof-dialog"
                      type="file"
                      accept="image/*,application/pdf"
                      className="h-8 cursor-pointer text-[0.7rem]"
                      onChange={(e) => {
                        setPaymentProofFile(e.target.files?.[0] ?? null);
                      }}
                    />
                    {paymentProofFile && paymentMethod === "bank" && (
                      <p className="text-[0.7rem] text-muted-foreground">
                        Selected: {paymentProofFile.name}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {paymentMethod === "card" && (
                <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[0.7rem] text-slate-800">
                  <p className="font-semibold text-slate-900">
                    Credit / Debit card
                  </p>
                  <p className="text-[0.7rem] text-muted-foreground">
                    Card payments would normally redirect you to a secure
                    payment page. For this demo, no actual card processing is
                    implemented.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    setShowPaymentDialog(false);
                    setShowGcashPaymentSection(false);
                    setPaymentProofFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={
                    saving ||
                    ((paymentMethod === "gcash" || paymentMethod === "bank") &&
                      !paymentProofFile)
                  }
                  onClick={async () => {
                    if (!selectedReservation) return;
                    const methodMap: Record<PaymentMethod, string> = {
                      gcash: "GCash",
                      bank: "Bank Transfer",
                      card: "Cash",
                    };
                    setSaving(true);
                    try {
                      let receiptUrl: string | undefined;
                      if (
                        paymentMethod === "gcash" ||
                        paymentMethod === "bank"
                      ) {
                        if (!paymentProofFile) {
                          throw new Error("Please attach proof of payment.");
                        }
                        receiptUrl = await uploadDormConnectFile(
                          paymentProofFile
                        );
                      }
                      const res = await fetch("/api/student/payments", {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          reservationId: selectedReservation.id,
                          amount: selectedReservation.monthlyRent * 3,
                          method: methodMap[paymentMethod],
                          status: "Pending",
                          receiptUrl: receiptUrl ?? null,
                          description: `Initial payment (${paymentMethod})${paymentProofFile ? ` — ${paymentProofFile.name}` : ""}`,
                        }),
                      });
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setShowPaymentDialog(false);
                      setShowGcashPaymentSection(false);
                      setPaymentProofFile(null);
                      await loadData();
                    } catch (e) {
                      setLoadError(
                        e instanceof Error ? e.message : "Payment log failed"
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving…" : "Submit payment record"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

