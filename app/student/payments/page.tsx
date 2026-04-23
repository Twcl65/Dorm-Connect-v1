"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Eye, Loader2 } from "lucide-react";
import { ProofMedia } from "@/components/proof-media";
import { Input } from "@/components/ui/input";

type PaymentStatus = "Paid" | "Pending" | "Failed" | "Overdue";

type Payment = {
  id: string;
  source?: "student_app" | "landlord_entry";
  dormName: string;
  roomNo: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  date: string;
  moveInDate: string;
  leaseMonths: number;
  monthlyRent: number;
  location: string;
  landlord: string;
  distance: string;
  documentType: string;
  roomDescription?: string;
  images: string[];
  receiptUrl?: string;
  proofImageUrl?: string;
  landlordProofUrl?: string;
  referenceNo?: string;
  paidAt?: string;
  leasePeriod?: string;
};

const ROWS_PER_PAGE = 5;

const PLACEHOLDER_IMG =
  "https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=1200";

function formatMonthYear(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric"
  });
}

export default function StudentPaymentsPage() {
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] =
    useState<PaymentStatus | "all">("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const loadData = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const payRes = await fetch("/api/student/payments", {
        credentials: "include",
      });
      const json = (await payRes.json()) as {
        payments?: Payment[];
        error?: string;
      };
      if (!payRes.ok) throw new Error(json.error ?? "Failed to load");
      const list = (json.payments ?? []).map((p) => ({
        ...p,
        images:
          p.images?.length > 0 ? p.images : [PLACEHOLDER_IMG],
      }));
      setPaymentsList(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setPaymentsList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showDetailsDialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showDetailsDialog]);

  const methods = useMemo(
    () =>
      Array.from(new Set(paymentsList.map((p) => p.method))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [paymentsList]
  );

  const filteredPayments = useMemo(() => {
    return paymentsList.filter((payment) => {
      const matchesStatus =
        statusFilter === "all" || payment.status === statusFilter;
      const matchesMethod =
        methodFilter === "all" || payment.method === methodFilter;
      return matchesStatus && matchesMethod;
    });
  }, [paymentsList, statusFilter, methodFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPayments.length / ROWS_PER_PAGE)
  );

  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return filteredPayments.slice(start, end);
  }, [filteredPayments, page]);

  const from =
    filteredPayments.length === 0
      ? 0
      : (page - 1) * ROWS_PER_PAGE + 1;
  const to =
    filteredPayments.length === 0
      ? 0
      : Math.min(page * ROWS_PER_PAGE, filteredPayments.length);

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
            Payments
          </h1>
          <p className="text-sm text-muted-foreground">
            History of payments for your dorm reservations.
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
                Payments
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Billing history for your dorm reservations.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-[0.7rem] text-muted-foreground">
                  Status
                </span>
                <select
                  className="h-8 w-32 rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value === "all"
                        ? "all"
                        : (e.target.value as PaymentStatus)
                    )
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Failed">Failed</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[0.7rem] text-muted-foreground">
                  Method
                </span>
                <select
                  className="h-8 w-32 rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                >
                  <option value="all">All methods</option>
                  {methods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
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
                <TableHead>Amount</TableHead>
                <TableHead>Date (Month)</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-4 font-semibold text-slate-600">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    {loading ? "Loading…" : "No payments found."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-xs font-mono text-slate-500">
                      {payment.id.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-sm font-medium text-slate-800">
                      {payment.dormName}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {payment.roomNo}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-slate-900">
                      ₱{payment.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {formatMonthYear(payment.date)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {payment.method}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          payment.status === "Paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : payment.status === "Pending"
                            ? "bg-amber-100 text-amber-800"
                            : payment.status === "Overdue"
                            ? "bg-red-100 text-red-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {payment.status}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end flex-wrap gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[0.65rem]"
                          asChild
                        >
                          <Link
                            href={`/student/payments/receipt/${payment.id}`}
                            target="_blank"
                          >
                            Receipt
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowDetailsDialog(true);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-2 border-t px-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.7rem] text-muted-foreground">
              Showing {from}–{to} of {filteredPayments.length} payments
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="inline-flex h-7 items-center rounded-md border bg-background px-2 text-[0.7rem] font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <div className="flex items-center gap-1 text-[0.7rem]">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => handlePageChange(pageNumber)}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border px-0 text-[0.7rem] ${
                        pageNumber === page
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-foreground"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="inline-flex h-7 items-center rounded-md border bg-background px-2 text-[0.7rem] font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment details dialog */}
      {showDetailsDialog && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-black/40 px-4 pb-4 pt-7 sm:pt-8">
          <Card className="flex max-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col border border-gray-300 bg-white">
            <CardHeader className="shrink-0 pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Payment Details
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Dorm information, rental terms, and your payment receipt.
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
            <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pt-3 text-xs text-slate-800">
              <div className="grid gap-4 md:grid-cols-[2fr,1.4fr]">
                {/* Dorm information */}
                <div className="space-y-2">
                  <div className="h-44 w-full overflow-hidden rounded-md bg-slate-200">
                    <img
                      src={selectedPayment.images[0] ?? PLACEHOLDER_IMG}
                      alt={selectedPayment.dormName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {selectedPayment.images.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPayment.images.slice(1, 6).map((src) => (
                        <img
                          key={src}
                          src={src}
                          alt=""
                          className="h-14 w-20 rounded border border-slate-200 object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {selectedPayment.roomDescription ? (
                    <div className="space-y-1">
                      <p className="text-[0.75rem] font-semibold text-slate-900">
                        About this room
                      </p>
                      <p className="whitespace-pre-line text-[0.7rem] text-slate-700">
                        {selectedPayment.roomDescription}
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedPayment.dormName} – Room {selectedPayment.roomNo}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Payment ID:{" "}
                      <span className="font-mono">{selectedPayment.id}</span>
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Location: {selectedPayment.location}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Distance: {selectedPayment.distance}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Move-in date:{" "}
                      <span className="font-medium text-slate-900">
                        {selectedPayment.moveInDate}
                      </span>
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Lease period:{" "}
                      <span className="font-medium text-slate-900">
                        {selectedPayment.leaseMonths} months
                      </span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[0.75rem] font-semibold text-slate-900">
                      Rental Information
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Monthly rent:{" "}
                      <span className="font-semibold text-slate-900">
                        ₱{selectedPayment.monthlyRent.toLocaleString()}
                      </span>
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Advance payment (1 month): ₱
                      {selectedPayment.monthlyRent.toLocaleString()}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Security deposit (1 month): ₱
                      {selectedPayment.monthlyRent.toLocaleString()}
                    </p>
                    <p className="mt-1 text-[0.65rem] text-slate-700">
                      <span className="font-semibold">Advance</span> is applied
                      to your first month&apos;s rent.{" "}
                      <span className="font-semibold">Security deposit</span> is
                      refundable at end of lease if there are no damages and all
                      dues are settled.
                    </p>
                  </div>
                </div>

                {/* Payment summary and receipt */}
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[0.8rem] font-semibold text-slate-900">
                      Payment Summary
                    </p>
                    <div className="mt-1 space-y-1 text-[0.7rem]">
                      <p>
                        <span className="font-semibold">Status:</span>{" "}
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                            selectedPayment.status === "Paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : selectedPayment.status === "Pending"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {selectedPayment.status}
                        </span>
                      </p>
                      {selectedPayment.source === "landlord_entry" && (
                        <p className="text-[0.65rem] text-muted-foreground">
                          Recorded by landlord (onsite / manual entry).
                        </p>
                      )}
                      {selectedPayment.referenceNo ? (
                        <p>
                          <span className="font-semibold">Reference:</span>{" "}
                          {selectedPayment.referenceNo}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-semibold">Method:</span>{" "}
                        {selectedPayment.method}
                      </p>
                      <p>
                        <span className="font-semibold">Amount paid:</span>{" "}
                        ₱{selectedPayment.amount.toLocaleString()}
                      </p>
                      {selectedPayment.paidAt && (
                        <p>
                          <span className="font-semibold">Paid on:</span>{" "}
                          {selectedPayment.paidAt}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[0.75rem] font-semibold text-slate-900">
                      Proof & attachments
                    </p>
                    {selectedPayment.proofImageUrl ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                        <div className="shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 p-1 sm:max-w-[200px]">
                          <ProofMedia
                            url={selectedPayment.proofImageUrl}
                            className="max-h-36 w-full rounded object-contain"
                          />
                        </div>
                        <p className="flex-1 text-[0.7rem] text-slate-700">
                          Payment proof attachment.
                        </p>
                      </div>
                    ) : null}
                    {selectedPayment.landlordProofUrl ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                        <div className="shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 p-1 sm:max-w-[200px]">
                          <ProofMedia
                            url={selectedPayment.landlordProofUrl}
                            className="max-h-36 w-full rounded object-contain"
                          />
                        </div>
                        <p className="flex-1 text-[0.7rem] text-slate-700">
                          Proof uploaded when the landlord recorded this payment.
                        </p>
                      </div>
                    ) : null}
                    {selectedPayment.receiptUrl ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                        <div className="shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 p-1 sm:max-w-[200px]">
                          <ProofMedia
                            url={selectedPayment.receiptUrl}
                            className="max-h-36 w-full rounded object-contain"
                          />
                        </div>
                        <p className="flex-1 text-[0.7rem] text-slate-700">
                          Uploaded receipt reference.
                        </p>
                      </div>
                    ) : null}
                    {!selectedPayment.proofImageUrl &&
                      !selectedPayment.landlordProofUrl &&
                      !selectedPayment.receiptUrl && (
                        <p className="text-[0.7rem] text-muted-foreground">
                          No proof image attached.
                        </p>
                      )}
                    <Button type="button" size="sm" className="h-8 text-xs" asChild>
                      <Link
                        href={`/student/payments/receipt/${selectedPayment.id}`}
                        target="_blank"
                      >
                        Open printable receipt
                      </Link>
                    </Button>
                  </div>
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

