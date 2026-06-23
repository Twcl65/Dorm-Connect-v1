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
import { Bell, Eye, FileText, Loader2 } from "lucide-react";
import { ProofMedia } from "@/components/proof-media";
import { PaymentReceiptCard } from "@/components/payments/payment-receipt-card";
import type { PaymentReceiptData } from "@/lib/payment-receipt-data";
import { uploadDormConnectFile } from "@/lib/upload-file-client";
import { LeasePaymentMonitoringCard } from "@/components/landlord/lease-payment-monitoring-card";

type PaymentStatus = "Paid" | "Pending" | "Overdue";
type PaymentMethod =
  | "GCash"
  | "Cash"
  | "Bank Transfer"
  | "Advance"
  | "Security deposit";

const ROWS_PER_PAGE = 5;

type PaymentSource = "landlord" | "student" | "advance" | "deposit";

function formatPaymentSourceLabel(source?: PaymentSource): string {
  if (source === "student") return "Student app";
  if (source === "advance") return "Advance payment";
  if (source === "deposit") return "Security deposit";
  return "Manual";
}

type Payment = {
  id: string;
  source?: PaymentSource;
  roomNo: string;
  propertyName?: string;
  name: string;
  amount: string;
  amountValue: number;
  method: PaymentMethod;
  status: PaymentStatus;
  referenceNo?: string;
  proofOfPaymentUrl?: string;
  date?: string;
  periodLabel?: string;
  tenantLeaseId?: string;
  reservationId?: string;
  studentUserId?: string;
};

type OnsiteRoomHint = {
  roomId: string;
  roomNo: string;
  propertyId: string;
  propertyName: string;
  suggestedTenantName: string | null;
  tenantLeaseId: string | null;
  studentUserId: string | null;
  studentReservationId: string | null;
};

type LeasePaymentMonitoring = {
  id: string;
  tenantName: string;
  roomNumber: string;
  propertyName?: string;
  linkedLeaseId?: string | null;
  leaseDuration: string;
  monthlyRent: number;
  leaseStartDate: string;
  leaseEndDate: string;
  remainingBalance: number;
  advancePayments: number;
  deposits: number;
  monthlySchedule: {
    id: string;
    monthNumber: number;
    dueDate: string;
    status: "Paid" | "Not Yet Paid";
    amount: number;
    paidDate?: string;
  }[];
  studentUserId?: string | null;
  source?: "reservation" | "lease";
  nextUnpaidMonthNumber?: number | null;
  nextUnpaidReminderSent?: boolean;
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
  const [leaseMonitoringList, setLeaseMonitoringList] = useState<LeasePaymentMonitoring[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<PaymentReceiptData | null>(
    null
  );
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<PaymentStatus>("Pending");
  const [editMethod, setEditMethod] = useState<PaymentMethod>("Cash");
  const [editAmount, setEditAmount] = useState(0);
  const [editDate, setEditDate] = useState("");
  const [editRef, setEditRef] = useState("");
  const [editProof, setEditProof] = useState("");
  const [proofUploading, setProofUploading] = useState(false);

  const [onsitePropertyId, setOnsitePropertyId] = useState("");
  const [onsiteRoomId, setOnsiteRoomId] = useState("");
  const [onsiteRoomHints, setOnsiteRoomHints] = useState<OnsiteRoomHint[]>([]);
  const [onsiteTenantLeaseId, setOnsiteTenantLeaseId] = useState("");
  const [onsiteStudentUserId, setOnsiteStudentUserId] = useState("");
  const [onsitePayerName, setOnsitePayerName] = useState("");
  const [onsiteAmount, setOnsiteAmount] = useState("");
  const [onsitePaidOn, setOnsitePaidOn] = useState("");
  const [onsiteProofFile, setOnsiteProofFile] = useState<File | null>(null);
  const [onsiteError, setOnsiteError] = useState<string | null>(null);
  const [onsiteSaving, setOnsiteSaving] = useState(false);
  const [showOnsiteDialog, setShowOnsiteDialog] = useState(false);

  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [showLeaseDetailsDialog, setShowLeaseDetailsDialog] = useState(false);
  const [selectedLeaseTenant, setSelectedLeaseTenant] =
    useState<LeasePaymentMonitoring | null>(null);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifyMonthNumber, setNotifyMonthNumber] = useState<number | null>(
    null
  );
  const [notifySending, setNotifySending] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null);
  const [editingScheduleMonth, setEditingScheduleMonth] = useState<number | null>(
    null
  );
  const [editScheduleStatus, setEditScheduleStatus] = useState<
    "Paid" | "Not Yet Paid"
  >("Paid");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [editPaymentSource, setEditPaymentSource] = useState<
    "none" | "advance" | "deposit"
  >("none");

  const loadData = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [payRes, hintsRes, leaseRes] = await Promise.all([
        fetch("/api/landlord/payments", { credentials: "include" }),
        fetch("/api/landlord/payments/onsite-hints", {
          credentials: "include",
        }),
        fetch("/api/landlord/lease-payment-monitoring", {
          credentials: "include",
        }),
      ]);
      const json = (await payRes.json()) as {
        payments?: Payment[];
        error?: string;
      };
      const hj = (await hintsRes.json()) as {
        rooms?: OnsiteRoomHint[];
        error?: string;
      };
      const lj = (await leaseRes.json()) as {
        leasePaymentMonitoring?: LeasePaymentMonitoring[];
        error?: string;
      };
      if (!payRes.ok) throw new Error(json.error ?? "Failed to load");
      setPaymentsList(json.payments ?? []);
      if (leaseRes.ok && lj.leasePaymentMonitoring) {
        setLeaseMonitoringList(lj.leasePaymentMonitoring);
      } else {
        setLeaseMonitoringList([]);
      }
      if (hintsRes.ok && hj.rooms) {
        setOnsiteRoomHints(hj.rooms);
      } else {
        setOnsiteRoomHints([]);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setPaymentsList([]);
      setLeaseMonitoringList([]);
      setOnsiteRoomHints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onsiteProperties = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of onsiteRoomHints) {
      map.set(h.propertyId, h.propertyName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [onsiteRoomHints]);

  const onsiteRoomsForProperty = useMemo(() => {
    if (!onsitePropertyId) return [];
    return onsiteRoomHints.filter((h) => h.propertyId === onsitePropertyId);
  }, [onsiteRoomHints, onsitePropertyId]);

  const selectedOnsiteHint = useMemo(
    () => onsiteRoomHints.find((h) => h.roomId === onsiteRoomId) ?? null,
    [onsiteRoomHints, onsiteRoomId]
  );

  const applyOnsiteRoomSelection = useCallback((hint: OnsiteRoomHint | null) => {
    if (!hint) {
      setOnsiteRoomId("");
      setOnsitePayerName("");
      setOnsiteTenantLeaseId("");
      setOnsiteStudentUserId("");
      return;
    }
    setOnsiteRoomId(hint.roomId);
    setOnsitePayerName(hint.suggestedTenantName?.trim() ?? "");
    setOnsiteTenantLeaseId(hint.tenantLeaseId ?? "");
    setOnsiteStudentUserId(hint.studentUserId ?? "");
  }, []);

  const resetOnsiteForm = useCallback(() => {
    setOnsitePropertyId("");
    setOnsiteRoomId("");
    setOnsitePayerName("");
    setOnsiteTenantLeaseId("");
    setOnsiteStudentUserId("");
    setOnsiteAmount("");
    setOnsitePaidOn("");
    setOnsiteProofFile(null);
    setOnsiteError(null);
  }, []);

  useEffect(() => {
    if (!showLeaseDetailsDialog || !selectedLeaseTenant) return;
    const updated = leaseMonitoringList.find(
      (l) => l.id === selectedLeaseTenant.id
    );
    if (updated) setSelectedLeaseTenant(updated);
  }, [leaseMonitoringList, showLeaseDetailsDialog, selectedLeaseTenant?.id]);

  const saveScheduleMonthStatus = async (monthNumber: number) => {
    if (!selectedLeaseTenant) return;
    const month = selectedLeaseTenant.monthlySchedule.find(
      (m) => m.monthNumber === monthNumber
    );
    if (!month) return;

    setScheduleSaving(true);
    setLoadError(null);
    const leaseRef =
      selectedLeaseTenant.source === "reservation"
        ? { reservationId: selectedLeaseTenant.id }
        : { leaseId: selectedLeaseTenant.id };
    const paidOn = new Date().toISOString().slice(0, 10);

    try {
      if (
        editPaymentSource === "advance" ||
        editPaymentSource === "deposit"
      ) {
        const res = await fetch(
          "/api/landlord/lease-payment-monitoring/apply-credit",
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              monthNumber,
              fundSource: editPaymentSource,
              paidOn,
              ...leaseRef,
            }),
          }
        );
        const j = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Failed to apply payment");
      } else {
        const res = await fetch(
          "/api/landlord/lease-payment-monitoring/schedule",
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              monthNumber,
              status: editScheduleStatus,
              paidOn: editScheduleStatus === "Paid" ? paidOn : null,
              ...leaseRef,
            }),
          }
        );
        const j = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Failed to update");
      }
      setEditingScheduleMonth(null);
      setEditPaymentSource("none");
      await loadData();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setScheduleSaving(false);
    }
  };

  const filteredPayments = useMemo(
    () =>
      paymentsList.filter((p) => {
        const srcLabel =
          formatPaymentSourceLabel(p.source).toLowerCase();
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

  const leaseTenantTransactions = useMemo(() => {
    if (!selectedLeaseTenant) return [];
    const room = selectedLeaseTenant.roomNumber.trim().toLowerCase();
    const name = selectedLeaseTenant.tenantName.trim().toLowerCase();
    const leaseId =
      selectedLeaseTenant.source === "lease"
        ? selectedLeaseTenant.id
        : selectedLeaseTenant.linkedLeaseId ?? null;
    const reservationId =
      selectedLeaseTenant.source === "reservation"
        ? selectedLeaseTenant.id
        : null;

    return paymentsList
      .filter((p) => {
        if (reservationId && p.reservationId === reservationId) return true;
        if (leaseId && p.tenantLeaseId === leaseId) return true;
        if (
          selectedLeaseTenant.studentUserId &&
          p.studentUserId === selectedLeaseTenant.studentUserId &&
          p.roomNo.trim().toLowerCase() === room
        ) {
          return true;
        }
        return (
          p.roomNo.trim().toLowerCase() === room &&
          p.name.trim().toLowerCase() === name
        );
      })
      .sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });
  }, [paymentsList, selectedLeaseTenant]);

  const openNotifyForLease = (lease: LeasePaymentMonitoring) => {
    if (lease.nextUnpaidReminderSent) return;
    setSelectedLeaseTenant(lease);
    setNotifySuccess(null);
    const nextUnpaid = lease.monthlySchedule.find((m) => m.status === "Not Yet Paid");
    setNotifyMonthNumber(nextUnpaid?.monthNumber ?? null);
    setNotifyMessage(
      nextUnpaid
        ? `Reminder: your rent of ₱${lease.monthlyRent.toLocaleString()} for Room ${lease.roomNumber} is due on ${new Date(nextUnpaid.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
        : `Reminder regarding your lease for Room ${lease.roomNumber}.`
    );
    setShowNotifyDialog(true);
  };

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

  const openReceipt = async (p: Payment) => {
    setShowReceiptDialog(true);
    setReceiptPayment(null);
    setReceiptError(null);
    setReceiptLoading(true);
    try {
      const source = p.source === "student" ? "student" : "landlord";
      const res = await fetch(
        `/api/landlord/payments/receipt?id=${encodeURIComponent(p.id)}&source=${source}`,
        { credentials: "include" }
      );
      const json = (await res.json()) as {
        payment?: PaymentReceiptData;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load receipt");
      setReceiptPayment(json.payment ?? null);
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : "Failed to load receipt");
    } finally {
      setReceiptLoading(false);
    }
  };

  const openPaymentDetails = (p: Payment) => {
    setSelectedPayment(p);
    setEditStatus(p.status);
    setEditMethod(p.method);
    setEditAmount(p.amountValue);
    setEditDate(p.date ?? "");
    setEditRef(p.referenceNo ?? "");
    setEditProof(p.proofOfPaymentUrl ?? "");
    setShowDetailsDialog(true);
  };

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(1, totalPages)));
  }, [totalPages]);

  useEffect(() => {
    if (!showDetailsDialog && !showOnsiteDialog && !showReceiptDialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showDetailsDialog, showOnsiteDialog, showReceiptDialog]);

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
              resetOnsiteForm();
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
                    {formatPaymentSourceLabel(p.source)}
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
                        className="h-7 px-2 text-[0.7rem] flex items-center gap-1"
                        onClick={() => void openReceipt(p)}
                      >
                        <FileText className="h-3 w-3" />
                        View Receipt
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                        onClick={() => openPaymentDetails(p)}
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

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <CardTitle className="text-sm font-semibold text-slate-800">
            Lease payment monitoring
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Monthly rent schedule per tenant. Paid months update when payments are
            recorded or approved.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : leaseMonitoringList.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No active leases with payment schedules yet. Confirm a student
              reservation or add a tenant under Tenants.
            </p>
          ) : (
            leaseMonitoringList.map((lease) => (
              <LeasePaymentMonitoringCard
                key={lease.id}
                {...lease}
                nextUnpaidReminderSent={lease.nextUnpaidReminderSent}
                onViewDetails={() => {
                  setSelectedLeaseTenant(lease);
                  setShowLeaseDetailsDialog(true);
                }}
                onNotifyTenant={
                  lease.nextUnpaidReminderSent
                    ? undefined
                    : () => openNotifyForLease(lease)
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      {showOnsiteDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 pb-8 sm:py-10">
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
                  <label className="font-medium text-slate-800">Dorm / property</label>
                  {onsiteProperties.length > 0 ? (
                    <select
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                      value={onsitePropertyId}
                      onChange={(e) => {
                        setOnsitePropertyId(e.target.value);
                        applyOnsiteRoomSelection(null);
                      }}
                    >
                      <option value="">Select property</option>
                      {onsiteProperties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[0.65rem] text-muted-foreground">
                      Add a property and rooms under Rooms first.
                    </p>
                  )}
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="font-medium text-slate-800">Room & tenant</label>
                  {onsitePropertyId && onsiteRoomsForProperty.length > 0 ? (
                    <select
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                      value={onsiteRoomId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const hint = onsiteRoomsForProperty.find(
                          (h) => h.roomId === id
                        );
                        applyOnsiteRoomSelection(hint ?? null);
                      }}
                    >
                      <option value="">Select room</option>
                      {onsiteRoomsForProperty.map((h) => (
                        <option key={h.roomId} value={h.roomId}>
                          Room {h.roomNo}
                          {h.suggestedTenantName
                            ? ` — ${h.suggestedTenantName}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      className="h-8 text-xs bg-muted"
                      disabled
                      placeholder={
                        onsitePropertyId
                          ? "No rooms for this property"
                          : "Select a property first"
                      }
                      value=""
                      readOnly
                    />
                  )}
                  <p className="text-[0.65rem] text-muted-foreground">
                    Choosing a room fills the tenant name and links the payment to
                    that student&apos;s account when they booked through the app.
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
                {onsiteStudentUserId ? (
                  <div className="space-y-1 md:col-span-2">
                    <label className="font-medium text-slate-800">Tenant ID</label>
                    <Input
                      className="h-8 text-xs font-mono bg-muted"
                      value={onsiteStudentUserId}
                      readOnly
                      disabled
                    />
                    <p className="text-[0.65rem] text-muted-foreground">
                      Student account ID — payment is credited to this tenant.
                    </p>
                  </div>
                ) : selectedOnsiteHint && !onsiteStudentUserId ? (
                  <p className="md:col-span-2 text-[0.65rem] text-amber-800">
                    No student app account linked to this room. Payment is saved
                    under the tenant name only.
                  </p>
                ) : null}
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
                    !onsiteRoomId.trim() ||
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
                      const hint = selectedOnsiteHint;
                      const res = await fetch("/api/landlord/payments", {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          roomId: onsiteRoomId,
                          roomNo: hint?.roomNo,
                          tenantLeaseId: onsiteTenantLeaseId || undefined,
                          studentUserId: onsiteStudentUserId || undefined,
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
                      resetOnsiteForm();
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 pb-8 sm:py-10">
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

      {showLeaseDetailsDialog && selectedLeaseTenant && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <Card className="w-full max-w-2xl border border-gray-300 bg-white">
            <CardHeader className="border-b bg-muted/40 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {selectedLeaseTenant.tenantName}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Room {selectedLeaseTenant.roomNumber} ·{" "}
                    {selectedLeaseTenant.leaseDuration} · ₱
                    {selectedLeaseTenant.monthlyRent.toLocaleString()} / month
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-[0.7rem] bg-red-500 text-white hover:bg-red-600"
                    onClick={() => {
                      setShowLeaseDetailsDialog(false);
                      openNotifyForLease(selectedLeaseTenant);
                    }}
                  >
                    <Bell className="h-3 w-3" />
                    Notify
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[0.7rem]"
                    onClick={() => {
                      setEditingScheduleMonth(null);
                      setShowLeaseDetailsDialog(false);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Remaining balance</p>
                  <p className="font-semibold">₱{selectedLeaseTenant.remainingBalance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Advance payments</p>
                  <p className="font-semibold">₱{selectedLeaseTenant.advancePayments.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Deposits</p>
                  <p className="font-semibold">₱{selectedLeaseTenant.deposits.toLocaleString()}</p>
                </div>
              </div>
              <p className="text-[0.65rem] text-muted-foreground">
                Click <span className="font-medium">Edit Status</span> on any month.
                Use <span className="font-medium">Use this as payment</span> to pay
                from advance or security deposit when balance is still available.
              </p>
              <div>
                <p className="mb-2 font-semibold text-slate-800">Monthly payment records</p>
                <Table bordered={false}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedLeaseTenant.monthlySchedule.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>Month {m.monthNumber}</TableCell>
                        <TableCell>
                          {new Date(m.dueDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>₱{m.amount.toLocaleString()}</TableCell>
                        <TableCell
                          className={
                            m.status === "Paid"
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }
                        >
                          {m.status}
                        </TableCell>
                        <TableCell className="min-w-[200px] text-right align-top">
                          {editingScheduleMonth === m.monthNumber ? (
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex w-full min-w-[180px] flex-col gap-1 text-left">
                                <label className="text-[0.6rem] font-medium text-slate-600">
                                  Status
                                </label>
                                <select
                                  className="h-7 w-full rounded-md border border-gray-300 bg-white px-1.5 text-[0.65rem]"
                                  value={editScheduleStatus}
                                  onChange={(e) =>
                                    setEditScheduleStatus(
                                      e.target.value as "Paid" | "Not Yet Paid"
                                    )
                                  }
                                  disabled={scheduleSaving}
                                >
                                  <option value="Paid">Paid</option>
                                  <option value="Not Yet Paid">
                                    Not Yet Paid
                                  </option>
                                </select>
                              </div>
                              <div className="flex w-full flex-col gap-1 text-left">
                                <label className="text-[0.6rem] font-medium text-slate-600">
                                  Use this as payment
                                </label>
                                <select
                                  className="h-7 w-full rounded-md border border-gray-300 bg-white px-1.5 text-[0.65rem]"
                                  value={editPaymentSource}
                                  onChange={(e) => {
                                    const src = e.target.value as
                                      | "none"
                                      | "advance"
                                      | "deposit";
                                    setEditPaymentSource(src);
                                    if (src === "advance" || src === "deposit") {
                                      setEditScheduleStatus("Paid");
                                    }
                                  }}
                                  disabled={scheduleSaving}
                                >
                                  <option value="none">
                                    {editScheduleStatus === "Paid"
                                      ? "None (mark paid only)"
                                      : "None"}
                                  </option>
                                  <option
                                    value="advance"
                                    disabled={
                                      m.status === "Paid" ||
                                      selectedLeaseTenant.advancePayments <
                                        m.amount
                                    }
                                  >
                                    {selectedLeaseTenant.advancePayments <
                                    m.amount
                                      ? "Advance payment (already used)"
                                      : `Advance payment (₱${selectedLeaseTenant.advancePayments.toLocaleString()} available)`}
                                  </option>
                                  <option
                                    value="deposit"
                                    disabled={
                                      m.status === "Paid" ||
                                      selectedLeaseTenant.deposits < m.amount
                                    }
                                  >
                                    {selectedLeaseTenant.deposits < m.amount
                                      ? "Security deposit (already used)"
                                      : `Security deposit (₱${selectedLeaseTenant.deposits.toLocaleString()} available)`}
                                  </option>
                                </select>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 px-2 text-[0.65rem]"
                                  disabled={scheduleSaving}
                                  onClick={() =>
                                    void saveScheduleMonthStatus(m.monthNumber)
                                  }
                                >
                                  {scheduleSaving ? "Saving…" : "Save"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[0.65rem]"
                                  disabled={scheduleSaving}
                                  onClick={() => {
                                    setEditingScheduleMonth(null);
                                    setEditPaymentSource("none");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[0.65rem]"
                              disabled={scheduleSaving}
                              onClick={() => {
                                setEditingScheduleMonth(m.monthNumber);
                                setEditScheduleStatus(m.status);
                                setEditPaymentSource("none");
                              }}
                            >
                              Edit Status
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <p className="mb-2 font-semibold text-slate-800">Transaction history</p>
                {leaseTenantTransactions.length === 0 ? (
                  <p className="text-muted-foreground">No recorded payments for this tenant yet.</p>
                ) : (
                  <Table bordered={false}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Room No.</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaseTenantTransactions.map((p) => (
                        <TableRow key={`${p.source ?? "landlord"}-${p.id}`}>
                          <TableCell className="text-xs font-mono text-slate-500">
                            {p.id.slice(0, 8)}…
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {formatPaymentSourceLabel(p.source)}
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
                                className="h-7 px-2 text-[0.7rem] flex items-center gap-1"
                                onClick={() => void openReceipt(p)}
                              >
                                <FileText className="h-3 w-3" />
                                View Receipt
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                                onClick={() => openPaymentDetails(p)}
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
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showNotifyDialog && selectedLeaseTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="border-b pb-2">
              <CardTitle className="text-sm font-semibold">
                Notify {selectedLeaseTenant.tenantName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs">
              {notifySuccess && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[0.7rem] text-emerald-800">
                  {notifySuccess}
                </div>
              )}
              <textarea
                className="min-h-[100px] w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                disabled={notifySending || Boolean(notifySuccess)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowNotifyDialog(false);
                    setNotifySuccess(null);
                  }}
                >
                  {notifySuccess ? "Close" : "Cancel"}
                </Button>
                {!notifySuccess && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      notifySending ||
                      !notifyMessage.trim() ||
                      notifyMonthNumber == null
                    }
                    onClick={async () => {
                      setNotifySending(true);
                      setLoadError(null);
                      try {
                        const res = await fetch(
                          "/api/landlord/lease-payment-monitoring/notify",
                          {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              message: notifyMessage.trim(),
                              monthNumber: notifyMonthNumber,
                              ...(selectedLeaseTenant.source === "reservation"
                                ? { reservationId: selectedLeaseTenant.id }
                                : { leaseId: selectedLeaseTenant.id }),
                            }),
                          }
                        );
                        const j = (await res.json()) as {
                          error?: string;
                          alreadyNotified?: boolean;
                        };
                        if (!res.ok) {
                          throw new Error(j.error ?? "Failed");
                        }
                        setNotifySuccess(
                          "Notified successfully for this month"
                        );
                        await loadData();
                      } catch (e) {
                        setLoadError(
                          e instanceof Error ? e.message : "Notify failed"
                        );
                      } finally {
                        setNotifySending(false);
                      }
                    }}
                  >
                    {notifySending ? "Sending…" : "Send"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showReceiptDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <div className="w-full max-w-lg space-y-3">
            <div className="flex justify-end gap-2 print:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-white"
                onClick={() => window.print()}
                disabled={!receiptPayment}
              >
                Print / Save as PDF
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs bg-white"
                onClick={() => {
                  setShowReceiptDialog(false);
                  setReceiptPayment(null);
                  setReceiptError(null);
                }}
              >
                Close
              </Button>
            </div>
            {receiptLoading && (
              <div className="flex items-center justify-center rounded-lg border bg-white py-16 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading receipt…
              </div>
            )}
            {receiptError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {receiptError}
              </div>
            )}
            {receiptPayment && (
              <PaymentReceiptCard
                payment={receiptPayment}
                footerNote="This receipt was generated from DormConnect. Keep for your records."
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

