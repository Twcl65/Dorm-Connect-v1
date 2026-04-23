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
import { Eye, Loader2 } from "lucide-react";
import { ProofMedia } from "@/components/proof-media";
import { uploadDormConnectFile } from "@/lib/upload-file-client";

type PaymentStatus = "Paid" | "Pending" | "Overdue";
type PaymentMethod = "GCash" | "Cash" | "Bank Transfer";

const ROWS_PER_PAGE = 5;

type Payment = {
  id: string;
  source?: "landlord" | "student";
  roomNo: string;
  name: string;
  amount: string;
  amountValue: number;
  method: PaymentMethod;
  status: PaymentStatus;
  referenceNo?: string;
  proofOfPaymentUrl?: string;
  date?: string;
  periodLabel?: string;
};

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
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

export default function LandlordPaymentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">(
    "all"
  );
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [editStatus, setEditStatus] = useState<PaymentStatus>("Pending");
  const [editMethod, setEditMethod] = useState<PaymentMethod>("Cash");
  const [editAmount, setEditAmount] = useState(0);
  const [editDate, setEditDate] = useState("");
  const [editRef, setEditRef] = useState("");
  const [editProof, setEditProof] = useState("");
  const [proofUploading, setProofUploading] = useState(false);

  const [onsiteRoomNo, setOnsiteRoomNo] = useState("");
  const [onsiteRoomHints, setOnsiteRoomHints] = useState<
    { roomNo: string; suggestedTenantName: string | null }[]
  >([]);
  const [onsitePayerName, setOnsitePayerName] = useState("");
  const [onsiteAmount, setOnsiteAmount] = useState("");
  const [onsitePaidOn, setOnsitePaidOn] = useState("");
  const [onsiteProofFile, setOnsiteProofFile] = useState<File | null>(null);
  const [onsiteError, setOnsiteError] = useState<string | null>(null);
  const [onsiteSaving, setOnsiteSaving] = useState(false);
  const [showOnsiteDialog, setShowOnsiteDialog] = useState(false);

  const loadData = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [payRes, hintsRes] = await Promise.all([
        fetch("/api/landlord/payments", { credentials: "include" }),
        fetch("/api/landlord/payments/onsite-hints", {
          credentials: "include",
        }),
      ]);
      const json = (await payRes.json()) as {
        payments?: Payment[];
        error?: string;
      };
      const hj = (await hintsRes.json()) as {
        rooms?: { roomNo: string; suggestedTenantName: string | null }[];
        error?: string;
      };
      if (!payRes.ok) throw new Error(json.error ?? "Failed to load");
      setPaymentsList(json.payments ?? []);
      if (hintsRes.ok && hj.rooms) {
        setOnsiteRoomHints(hj.rooms);
      } else {
        setOnsiteRoomHints([]);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setPaymentsList([]);
      setOnsiteRoomHints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredPayments = useMemo(
    () =>
      paymentsList.filter((p) => {
        const srcLabel =
          p.source === "student" ? "student app" : "manual entry";
        const matchesSearch =
          search.trim().length === 0 ||
          p.id.toLowerCase().includes(search.toLowerCase()) ||
          p.roomNo.toLowerCase().includes(search.toLowerCase()) ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          srcLabel.includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || p.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [paymentsList, search, statusFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / ROWS_PER_PAGE));

  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return filteredPayments.slice(start, end);
  }, [filteredPayments, page]);

  const from =
    filteredPayments.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1;
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

  useEffect(() => {
    if (!showDetailsDialog && !showOnsiteDialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showDetailsDialog, showOnsiteDialog]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Manual landlord entries and payments submitted by students for your
            rooms.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setOnsiteError(null);
              setShowOnsiteDialog(true);
            }}
          >
            Record onsite payment
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => void loadData()}
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
                Payment records by tenant and room.
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
                      : (e.target.value as PaymentStatus)
                  )
                }
              >
                <option value="all">All statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Overdue">Overdue</option>
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
                <TableHead>Period</TableHead>
                <TableHead>Room No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-4 font-semibold text-slate-600">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    {loading ? "Loading…" : "No payment records yet."}
                  </TableCell>
                </TableRow>
              )}
              {paginatedPayments.map((p) => (
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
                  <TableCell className="text-xs text-slate-700">{p.roomNo}</TableCell>
                  <TableCell className="text-sm font-medium text-slate-800">
                    {p.name}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">{p.amount}</TableCell>
                  <TableCell className="text-xs text-slate-700">{p.method}</TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                        onClick={() => {
                          setSelectedPayment(p);
                          setEditStatus(p.status);
                          setEditMethod(p.method);
                          setEditAmount(p.amountValue);
                          setEditDate(p.date ?? "");
                          setEditRef(p.referenceNo ?? "");
                          setEditProof(p.proofOfPaymentUrl ?? "");
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
              Showing {from}–{to} of {filteredPayments.length} payments
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
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className="h-7 w-7 px-0 text-[0.7rem]"
                    onClick={() => handlePageChange(p)}
                  >
                    {p}
                  </Button>
                ))}
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

      {showOnsiteDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-black/40 px-4 pb-4 pt-7 sm:pt-8">
          <Card className="flex max-h-[calc(100vh-5rem)] w-full max-w-lg flex-col border border-gray-300 bg-white">
            <CardHeader className="shrink-0 border-b bg-muted/40 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Record onsite cash payment
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Log cash received at the dorm: room, tenant name, amount,
                    date paid, and a photo of the receipt or signed slip.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-[0.7rem]"
                  onClick={() => setShowOnsiteDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pt-4 text-xs">
              {onsiteError && (
                <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[0.7rem] text-red-800">
                  {onsiteError}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <label className="font-medium text-slate-800">Room</label>
                  {onsiteRoomHints.length > 0 ? (
                    <select
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                      value={onsiteRoomNo}
                      onChange={(e) => {
                        const no = e.target.value;
                        setOnsiteRoomNo(no);
                        const hint = onsiteRoomHints.find((h) => h.roomNo === no);
                        setOnsitePayerName(
                          hint?.suggestedTenantName?.trim() ?? ""
                        );
                      }}
                    >
                      <option value="">Select room</option>
                      {onsiteRoomHints.map((h) => (
                        <option key={h.roomNo} value={h.roomNo}>
                          Room {h.roomNo}
                          {h.suggestedTenantName
                            ? ` — ${h.suggestedTenantName}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      className="h-8 text-xs"
                      placeholder="e.g. 07"
                      value={onsiteRoomNo}
                      onChange={(e) => setOnsiteRoomNo(e.target.value)}
                    />
                  )}
                  <p className="text-[0.65rem] text-muted-foreground">
                    {onsiteRoomHints.length > 0
                      ? "Tenant name fills from an active booking or lease; you can edit it."
                      : "Add rooms under Rooms first, or type the room number."}
                  </p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="font-medium text-slate-800">Tenant name</label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Student full name"
                    value={onsitePayerName}
                    onChange={(e) => setOnsitePayerName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-slate-800">Amount (₱)</label>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 text-xs"
                    value={onsiteAmount}
                    onChange={(e) => setOnsiteAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-slate-800">Paid on</label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={onsitePaidOn}
                    onChange={(e) => setOnsitePaidOn(e.target.value)}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="font-medium text-slate-800">
                    Proof (receipt / slip photo)
                  </label>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="h-8 cursor-pointer text-xs"
                    onChange={(e) =>
                      setOnsiteProofFile(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setShowOnsiteDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={
                    onsiteSaving ||
                    !onsiteRoomNo.trim() ||
                    !onsitePayerName.trim() ||
                    !onsiteAmount ||
                    !onsitePaidOn ||
                    !onsiteProofFile
                  }
                  onClick={async () => {
                    setOnsiteError(null);
                    setOnsiteSaving(true);
                    try {
                      const proofUrl = await uploadDormConnectFile(onsiteProofFile!);
                      const res = await fetch("/api/landlord/payments", {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          roomNo: onsiteRoomNo.trim(),
                          payerName: onsitePayerName.trim(),
                          amount: Number(onsiteAmount),
                          method: "Cash",
                          status: "Paid",
                          paidOn: onsitePaidOn,
                          proofUrl,
                        }),
                      });
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed to save");
                      setOnsiteRoomNo("");
                      setOnsitePayerName("");
                      setOnsiteAmount("");
                      setOnsitePaidOn("");
                      setOnsiteProofFile(null);
                      setShowOnsiteDialog(false);
                      await loadData();
                    } catch (e) {
                      setOnsiteError(
                        e instanceof Error ? e.message : "Could not save payment"
                      );
                    } finally {
                      setOnsiteSaving(false);
                    }
                  }}
                >
                  {onsiteSaving ? "Saving…" : "Save onsite payment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showDetailsDialog && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-black/40 px-4 pb-4 pt-7 sm:pt-8">
          <Card className="flex max-h-[calc(100vh-5rem)] w-full max-w-4xl flex-col border border-gray-300 bg-white">
            <CardHeader className="shrink-0 pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Payment Details
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Full information about this tenant payment.
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
            <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pt-3 text-xs text-slate-800">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {selectedPayment.name}
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Payment ID:{" "}
                  <span className="font-mono">{selectedPayment.id}</span>
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Room No.:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedPayment.roomNo}
                  </span>
                </p>
                {selectedPayment.date && (
                  <p className="text-[0.7rem] text-muted-foreground">
                    Date:{" "}
                    <span className="font-medium text-slate-900">
                      {selectedPayment.date}
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Payment Summary
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Amount:{" "}
                  <span className="font-semibold text-slate-900">
                    {selectedPayment.amount}
                  </span>
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Method:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedPayment.method}
                  </span>
                </p>
                <p className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                  Status:{" "}
                  <PaymentStatusBadge status={selectedPayment.status} />
                </p>
                {selectedPayment.referenceNo && (
                  <p className="text-[0.7rem] text-muted-foreground">
                    Reference No.:{" "}
                    <span className="font-medium text-slate-900">
                      {selectedPayment.referenceNo}
                    </span>
                  </p>
                )}
              </div>

              {(selectedPayment.proofOfPaymentUrl || editProof) && (
                <div className="space-y-1">
                  <p className="text-[0.75rem] font-semibold text-slate-900">
                    Proof of Payment
                  </p>
                  <div className="w-full max-w-xs overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2">
                    <ProofMedia
                      url={(editProof || selectedPayment.proofOfPaymentUrl) ?? ""}
                      className="max-h-40 w-full rounded object-contain"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/80 p-3">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Update record
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[0.65rem] text-muted-foreground">
                      Status
                    </label>
                    <select
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                      value={editStatus}
                      onChange={(e) =>
                        setEditStatus(e.target.value as PaymentStatus)
                      }
                    >
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.65rem] text-muted-foreground">
                      Method
                    </label>
                    <select
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                      value={editMethod}
                      onChange={(e) =>
                        setEditMethod(e.target.value as PaymentMethod)
                      }
                    >
                      <option value="GCash">GCash</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.65rem] text-muted-foreground">
                      Amount (₱)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 text-xs"
                      value={editAmount}
                      onChange={(e) =>
                        setEditAmount(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[0.65rem] text-muted-foreground">
                      Paid on
                    </label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[0.65rem] text-muted-foreground">
                      Reference No.
                    </label>
                    <Input
                      className="h-8 text-xs"
                      value={editRef}
                      onChange={(e) => setEditRef(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[0.65rem] text-muted-foreground">
                      Proof (upload or paste URL)
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                        className="h-8 cursor-pointer text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-[0.65rem]"
                        disabled={proofUploading}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          setProofUploading(true);
                          try {
                            const url = await uploadDormConnectFile(f);
                            setEditProof(url);
                          } catch (err) {
                            setLoadError(
                              err instanceof Error
                                ? err.message
                                : "Upload failed"
                            );
                          } finally {
                            setProofUploading(false);
                          }
                        }}
                      />
                      {proofUploading && (
                        <span className="text-[0.65rem] text-muted-foreground">
                          Uploading…
                        </span>
                      )}
                    </div>
                    <Input
                      className="h-8 text-xs"
                      value={editProof}
                      onChange={(e) => setEditProof(e.target.value)}
                      placeholder="/uploads/dormconnect/… or https://…"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
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
                  disabled={saving}
                  onClick={async () => {
                    if (!selectedPayment) return;
                    setSaving(true);
                    try {
                      const url =
                        selectedPayment.source === "student"
                          ? `/api/landlord/student-payments/${selectedPayment.id}`
                          : `/api/landlord/payments/${selectedPayment.id}`;
                      const res = await fetch(url, {
                        method: "PATCH",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          status: editStatus,
                          method: editMethod,
                          amount: editAmount,
                          paidOn: editDate || null,
                          referenceNo: editRef.trim(),
                          proofUrl: editProof.trim(),
                        }),
                      });
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setShowDetailsDialog(false);
                      await loadData();
                    } catch (e) {
                      setLoadError(
                        e instanceof Error ? e.message : "Failed to save"
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

