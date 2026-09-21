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
  TableRow,
} from "@/components/ui/table";
import { Eye, Loader2, X } from "lucide-react";
import { ProofMedia } from "@/components/proof-media";
import { Input } from "@/components/ui/input";
import { uploadDormConnectFile } from "@/lib/upload-file-client";

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

type UnpaidMonth = {
  dueDate: string;
  amount: number;
  monthNumber: number;
  monthLabel: string;
  dueLabel: string;
  dormName: string;
  roomNo: string;
  reservationId: string;
  gcashAccountName: string | null;
  gcashPhone: string | null;
  gcashQrCodeUrl: string | null;
  landlordName: string | null;
};

type TabFilter = "all" | "paid" | "unpaid";

const ROWS_PER_PAGE = 5;

const PLACEHOLDER_IMG =
  "https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=1200";

function formatMonthYear(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default function StudentPaymentsPage() {
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [unpaidMonths, setUnpaidMonths] = useState<UnpaidMonth[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [tabFilter, setTabFilter] = useState<TabFilter>("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [payMonth, setPayMonth] = useState<UnpaidMonth | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingPay, setSubmittingPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [liveGcash, setLiveGcash] = useState<{
    gcashAccountName: string | null;
    gcashPhone: string | null;
    gcashQrCodeUrl: string | null;
    landlordName: string | null;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const payRes = await fetch("/api/student/payments", {
        credentials: "include",
      });
      const json = (await payRes.json()) as {
        payments?: Payment[];
        unpaidMonths?: UnpaidMonth[];
        error?: string;
      };
      if (!payRes.ok) throw new Error(json.error ?? "Failed to load");
      const list = (json.payments ?? []).map((p) => ({
        ...p,
        images: p.images?.length > 0 ? p.images : [PLACEHOLDER_IMG],
      }));
      setPaymentsList(list);
      setUnpaidMonths(json.unpaidMonths ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setPaymentsList([]);
      setUnpaidMonths([]);
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

  useEffect(() => {
    if (!payMonth) {
      setLiveGcash(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/student/gcash?reservationId=${encodeURIComponent(payMonth.reservationId)}`,
          { credentials: "include" }
        );
        const json = (await res.json()) as {
          gcashAccountName?: string | null;
          gcashPhone?: string | null;
          gcashQrCodeUrl?: string | null;
          landlordName?: string | null;
        };
        if (!res.ok || cancelled) return;
        setLiveGcash({
          gcashAccountName: json.gcashAccountName ?? null,
          gcashPhone: json.gcashPhone ?? null,
          gcashQrCodeUrl: json.gcashQrCodeUrl ?? null,
          landlordName: json.landlordName ?? null,
        });
      } catch {
        if (!cancelled) setLiveGcash(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payMonth]);

  const counts = useMemo(
    () => ({
      all: paymentsList.length,
      paid: paymentsList.filter((p) => p.status === "Paid").length,
      unpaid: unpaidMonths.length,
    }),
    [paymentsList, unpaidMonths]
  );

  const showUnpaid = tabFilter === "unpaid";

  const filteredPayments = useMemo(() => {
    if (tabFilter === "unpaid") return [];
    if (tabFilter === "paid") {
      return paymentsList.filter((p) => p.status === "Paid");
    }
    return paymentsList;
  }, [paymentsList, tabFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPayments.length / ROWS_PER_PAGE)
  );

  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return filteredPayments.slice(start, start + ROWS_PER_PAGE);
  }, [filteredPayments, page]);

  const from =
    filteredPayments.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1;
  const to =
    filteredPayments.length === 0
      ? 0
      : Math.min(page * ROWS_PER_PAGE, filteredPayments.length);

  useEffect(() => {
    setPage(1);
  }, [tabFilter]);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(1, totalPages)));
  }, [totalPages]);

  const gcashName =
    liveGcash?.gcashAccountName?.trim() ||
    payMonth?.gcashAccountName?.trim() ||
    liveGcash?.landlordName ||
    payMonth?.landlordName ||
    "Landlord";
  const gcashPhone =
    liveGcash?.gcashPhone?.trim() || payMonth?.gcashPhone?.trim() || "";
  const gcashQr =
    liveGcash?.gcashQrCodeUrl?.trim() || payMonth?.gcashQrCodeUrl?.trim() || "";

  const receiptFile =
    selectedPayment?.receiptUrl ||
    selectedPayment?.proofImageUrl ||
    selectedPayment?.landlordProofUrl ||
    null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">
            All recorded payments, paid receipts, and months not yet paid.
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

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All", counts.all],
            ["paid", "Paid", counts.paid],
            ["unpaid", "Not yet paid", counts.unpaid],
          ] as const
        ).map(([key, label, count]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={tabFilter === key ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setTabFilter(key)}
          >
            {label}
            {count > 0 ? ` (${count})` : ""}
          </Button>
        ))}
      </div>

      {showUnpaid ? (
        <Card className="border border-gray-300 bg-white">
          <CardHeader className="border-b bg-muted/40 pb-3">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Not yet paid
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Upcoming rent months that still need a GCash payment.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {unpaidMonths.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                All scheduled rent months are paid. Thank you!
              </p>
            ) : (
              unpaidMonths.map((m) => (
                <div
                  key={`${m.reservationId}-${m.monthNumber}`}
                  className="flex flex-col gap-2 rounded-md border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-xs">
                    <p className="font-semibold text-slate-900">
                      {m.dormName} · Room {m.roomNo}
                    </p>
                    <p className="text-slate-700">{m.monthLabel}</p>
                    <p className="text-muted-foreground">
                      ₱{m.amount.toLocaleString()} · {m.dueLabel}
                    </p>
                    <p className="text-muted-foreground">Due {m.dueDate}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 bg-orange-500 text-xs text-white hover:bg-orange-600"
                    onClick={() => {
                      setPayError(null);
                      setProofFile(null);
                      setPayMonth(m);
                    }}
                  >
                    Pay now
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-gray-300 bg-white">
          <CardHeader className="border-b bg-muted/40 pb-3">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Payments
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Billing history for your dorm reservations.
            </p>
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
                  <TableHead className="pr-4 font-semibold text-slate-600">
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
                      {loading
                        ? "Loading…"
                        : tabFilter === "paid"
                          ? "No paid payments yet."
                          : "No payments recorded yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-xs text-slate-500">
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
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {payment.status === "Paid" ? "Paid" : payment.status}
                        </span>
                      </TableCell>
                      <TableCell className="pr-4">
                        <Button
                          size="sm"
                          className="h-7 px-2 text-[0.7rem] bg-sky-600 text-white hover:bg-sky-700"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowDetailsDialog(true);
                          }}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View details
                        </Button>
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                        onClick={() => setPage(pageNumber)}
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
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="inline-flex h-7 items-center rounded-md border bg-background px-2 text-[0.7rem] font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showDetailsDialog && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 pb-8 sm:py-10">
          <Card className="my-auto flex max-h-[min(92vh,calc(100dvh-2rem))] w-full max-w-5xl flex-col overflow-hidden border border-gray-300 bg-white">
            <CardHeader className="shrink-0 border-b bg-white pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    {selectedPayment.dormName} – Room {selectedPayment.roomNo}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Payment details and receipt.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => setShowDetailsDialog(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pt-3 text-xs text-slate-800">
              <div className="grid gap-4 md:grid-cols-[2fr,1.4fr]">
                <div className="space-y-2">
                  <div className="h-44 w-full overflow-hidden rounded-md bg-slate-200">
                    <img
                      src={selectedPayment.images[0] ?? PLACEHOLDER_IMG}
                      alt={selectedPayment.dormName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedPayment.dormName} – Room {selectedPayment.roomNo}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Location: {selectedPayment.location}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Move-in date:{" "}
                      <span className="font-medium text-slate-900">
                        {selectedPayment.moveInDate}
                      </span>
                    </p>
                    {selectedPayment.leasePeriod ? (
                      <p className="text-[0.7rem] text-muted-foreground">
                        Lease: {selectedPayment.leasePeriod}
                      </p>
                    ) : null}
                    <p className="text-[0.7rem] text-muted-foreground">
                      Monthly rent:{" "}
                      <span className="font-semibold text-slate-900">
                        ₱{selectedPayment.monthlyRent.toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[0.8rem] font-semibold text-slate-900">
                      Payment summary
                    </p>
                    <div className="mt-1 space-y-1 text-[0.7rem]">
                      <p>
                        Status:{" "}
                        <span className="font-medium">
                          {selectedPayment.status}
                        </span>
                      </p>
                      <p>
                        Method:{" "}
                        <span className="font-medium">
                          {selectedPayment.method}
                        </span>
                      </p>
                      <p>
                        Amount:{" "}
                        <span className="font-semibold">
                          ₱{selectedPayment.amount.toLocaleString()}
                        </span>
                      </p>
                      {selectedPayment.paidAt ? (
                        <p>Paid on: {selectedPayment.paidAt}</p>
                      ) : null}
                      {selectedPayment.referenceNo ? (
                        <p>Reference: {selectedPayment.referenceNo}</p>
                      ) : null}
                      {selectedPayment.source === "landlord_entry" ? (
                        <p className="text-muted-foreground">
                          Recorded by landlord (onsite / manual entry).
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {receiptFile ? (
                    <div className="overflow-hidden rounded-md border bg-slate-50 p-1">
                      <ProofMedia
                        url={receiptFile}
                        className="max-h-44 w-full rounded object-contain"
                      />
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      No proof image attached.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-3">
                {receiptFile ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    asChild
                  >
                    <a href={receiptFile} target="_blank" rel="noreferrer">
                      Download / view receipt file
                    </a>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="h-8 bg-sky-600 text-xs text-white hover:bg-sky-700"
                  asChild
                >
                  <Link
                    href={`/student/payments/receipt/${selectedPayment.id}`}
                  >
                    Open printable receipt
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {payMonth ? (
        lightboxUrl ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxUrl(null);
              }}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={lightboxUrl}
              alt="GCash QR"
              className="max-h-[90vh] max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <Card className="w-full max-w-lg border bg-white">
            <CardHeader className="border-b pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Pay now</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {payMonth.dormName} · {payMonth.monthLabel} · ₱
                    {payMonth.amount.toLocaleString()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPayMonth(null)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs">
              {payError ? (
                <p className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-red-800">
                  {payError}
                </p>
              ) : null}
              <div className="space-y-1">
                <label className="font-medium">Month</label>
                <select
                  className="h-8 w-full rounded-md border px-2"
                  value={String(payMonth.monthNumber)}
                  onChange={(e) => {
                    const next = unpaidMonths.find(
                      (m) => String(m.monthNumber) === e.target.value
                    );
                    if (next) setPayMonth(next);
                  }}
                >
                  {unpaidMonths.map((m) => (
                    <option key={m.monthNumber} value={String(m.monthNumber)}>
                      {m.monthLabel} · ₱{m.amount.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 rounded-md border border-sky-100 bg-sky-50 px-3 py-2">
                <p className="font-semibold">Pay with GCash</p>
                <p>
                  Account name: <span className="font-semibold">{gcashName}</span>
                </p>
                <p>
                  GCash number:{" "}
                  <span className="font-semibold">
                    {gcashPhone || "Not uploaded"}
                  </span>
                </p>
                {gcashQr ? (
                  <button
                    type="button"
                    className="h-32 w-32 overflow-hidden rounded-md bg-white"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setLightboxUrl(gcashQr);
                    }}
                  >
                    <img
                      src={gcashQr}
                      alt="GCash QR"
                      className="h-full w-full object-contain"
                    />
                  </button>
                ) : (
                  <p className="text-muted-foreground">
                    QR code not uploaded yet.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor="unpaid-proof">Upload payment screenshot</label>
                <Input
                  id="unpaid-proof"
                  type="file"
                  accept="image/*,application/pdf"
                  className="h-8 cursor-pointer text-xs"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                />
                {proofFile ? (
                  <p className="text-muted-foreground">
                    Selected: {proofFile.name}
                  </p>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 bg-orange-500 text-xs text-white hover:bg-orange-600"
                  disabled={submittingPay || !proofFile}
                  onClick={async () => {
                    if (!payMonth || !proofFile) return;
                    setSubmittingPay(true);
                    setPayError(null);
                    try {
                      const proofImageUrl = await uploadDormConnectFile(
                        proofFile
                      );
                      const res = await fetch("/api/student/payments", {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          reservationId: payMonth.reservationId,
                          amount: payMonth.amount,
                          method: "GCash",
                          status: "Pending",
                          proofImageUrl,
                          description: `GCash rent — ${payMonth.monthLabel}`,
                          scheduleMonthNumber: payMonth.monthNumber,
                          paidOnDate: new Date().toISOString().slice(0, 10),
                        }),
                      });
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setPayMonth(null);
                      setProofFile(null);
                      await loadData();
                    } catch (e) {
                      setPayError(
                        e instanceof Error ? e.message : "Payment failed"
                      );
                    } finally {
                      setSubmittingPay(false);
                    }
                  }}
                >
                  {submittingPay ? "Submitting…" : "Submit payment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        )
      ) : null}
    </div>
  );
}
