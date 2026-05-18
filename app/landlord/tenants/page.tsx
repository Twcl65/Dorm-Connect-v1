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
import { PenSquare, Eye, UserPlus, Loader2, CalendarClock } from "lucide-react";
import { cn } from "@/components/ui/utils";
import type { DueUrgency } from "@/lib/payment-schedule";

type PaymentStatus = "Paid" | "Pending" | "Overdue";
type PaymentFilter = PaymentStatus | "all" | "due_soon";

type MonthlyScheduleItem = {
  monthNumber: number;
  dueDate: string;
  status: "Paid" | "Not Yet Paid";
  amount: number;
  paidDate?: string;
};

type Tenant = {
  id: string;
  roomNo: string;
  name: string;
  leaseStart: string;
  leaseEnd: string;
  leasePeriod: string;
  leaseDuration?: string;
  paymentStatus: PaymentStatus;
  email?: string;
  contact?: string;
  monthlySchedule?: MonthlyScheduleItem[];
  paidMonths?: number;
  totalMonths?: number;
  nextDueDate?: string | null;
  nextDueAmount?: number | null;
  daysUntilDue?: number | null;
  dueUrgency?: DueUrgency;
  dueLabel?: string | null;
};

const ROWS_PER_PAGE = 5;

function DueUrgencyBadge({
  urgency,
  dueLabel,
}: {
  urgency?: DueUrgency;
  dueLabel?: string | null;
}) {
  if (!urgency || urgency === "paid") {
    return (
      <span className="text-[0.65rem] text-muted-foreground">All paid</span>
    );
  }
  const styles: Record<DueUrgency, string> = {
    paid: "bg-emerald-100 text-emerald-800",
    overdue: "bg-red-100 text-red-800 ring-1 ring-red-300",
    due_today: "bg-red-100 text-red-800 ring-1 ring-red-400",
    due_soon: "bg-amber-100 text-amber-900 ring-1 ring-amber-400",
    due_this_week: "bg-amber-50 text-amber-800",
    upcoming: "bg-sky-50 text-sky-800",
  };
  const labels: Record<DueUrgency, string> = {
    paid: "Paid",
    overdue: "Overdue",
    due_today: "Due today",
    due_soon: "Due soon",
    due_this_week: "Due this week",
    upcoming: "Upcoming",
  };
  return (
    <div className="space-y-0.5">
      <Badge
        className={cn(
          "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
          styles[urgency]
        )}
        variant="outline"
      >
        {labels[urgency]}
      </Badge>
      {dueLabel && (
        <p className="text-[0.65rem] text-slate-600 leading-snug">{dueLabel}</p>
      )}
    </div>
  );
}

function tenantRowHighlight(urgency?: DueUrgency): string {
  if (urgency === "overdue" || urgency === "due_today") {
    return "bg-red-50/80";
  }
  if (urgency === "due_soon") {
    return "bg-amber-50/90";
  }
  if (urgency === "due_this_week") {
    return "bg-amber-50/40";
  }
  if (urgency === "upcoming") {
    return "bg-sky-50/30";
  }
  return "";
}

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

export default function LandlordTenantsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [upcomingDue, setUpcomingDue] = useState<Tenant[]>([]);
  const [tenantsData, setTenantsData] = useState<Tenant[]>([]);
  const [propertyName, setPropertyName] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    activeLeases: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    dueSoon: 0,
    upcomingCount: 0,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTenant, setSelectedTenant] =
    useState<Tenant | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLeaseStart, setEditLeaseStart] = useState("");
  const [editLeaseEnd, setEditLeaseEnd] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] =
    useState<PaymentStatus>("Paid");
  const [editEmail, setEditEmail] = useState("");
  const [editContact, setEditContact] = useState("");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addRoomNo, setAddRoomNo] = useState("");
  const [vacantRoomNos, setVacantRoomNos] = useState<string[]>([]);
  const [loadingVacantRooms, setLoadingVacantRooms] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addContact, setAddContact] = useState("");
  const [addStartDate, setAddStartDate] = useState("");
  const [addEndDate, setAddEndDate] = useState("");
  const [addPaymentStatus, setAddPaymentStatus] =
    useState<PaymentStatus>("Pending");
  const [addRemarks, setAddRemarks] = useState("");

  const loadData = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/landlord/leases", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        propertyName?: string;
        leases?: Tenant[];
        upcomingDue?: Tenant[];
        stats?: typeof stats & {
          dueSoon?: number;
          dueThisWeek?: number;
          upcomingCount?: number;
        };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setPropertyName(json.propertyName ?? "");
      setTenantsData(json.leases ?? []);
      setUpcomingDue(json.upcomingDue ?? []);
      if (json.stats) setStats(json.stats);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setTenantsData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showAddDialog) return;
    let cancelled = false;
    setLoadingVacantRooms(true);
    void (async () => {
      try {
        const res = await fetch("/api/landlord/rooms-data", {
          credentials: "include",
        });
        const json = (await res.json()) as {
          rooms?: { roomNo: string; status: string }[];
        };
        if (cancelled) return;
        const nos = (json.rooms ?? [])
          .filter((r) => r.status === "Available")
          .map((r) => r.roomNo)
          .sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
          );
        setVacantRoomNos(nos);
      } catch {
        if (!cancelled) setVacantRoomNos([]);
      } finally {
        if (!cancelled) setLoadingVacantRooms(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAddDialog]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Tenants",
        value: String(stats.total),
        badge: "Leases",
        badgeVariant: "secondary" as const,
      },
      {
        label: "Active Leases",
        value: String(stats.activeLeases),
        badge: "In contract",
        badgeVariant: "success" as const,
      },
      {
        label: "Paid",
        value: String(stats.paid),
        badge: "Paid status",
        badgeVariant: "success" as const,
      },
      {
        label: "Due soon / overdue",
        value: `${stats.dueSoon ?? 0} / ${stats.overdue}`,
        badge: "Rent due",
        badgeVariant: "warning" as const,
      },
    ],
    [stats]
  );

  const filteredTenants = useMemo(
    () =>
      tenantsData.filter((tenant) => {
        const matchesSearch =
          search.trim().length === 0 ||
          tenant.name.toLowerCase().includes(search.toLowerCase()) ||
          tenant.roomNo.toLowerCase().includes(search.toLowerCase());
        const matchesPayment =
          paymentFilter === "all"
            ? true
            : paymentFilter === "due_soon"
              ? tenant.dueUrgency === "overdue" ||
                tenant.dueUrgency === "due_today" ||
                tenant.dueUrgency === "due_soon" ||
                tenant.dueUrgency === "due_this_week"
              : tenant.paymentStatus === paymentFilter;
        return matchesSearch && matchesPayment;
      }),
    [tenantsData, search, paymentFilter]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTenants.length / ROWS_PER_PAGE)
  );

  const paginatedTenants = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return filteredTenants.slice(start, end);
  }, [filteredTenants, page]);

  const from =
    filteredTenants.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1;
  const to =
    filteredTenants.length === 0
      ? 0
      : Math.min(page * ROWS_PER_PAGE, filteredTenants.length);

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
            Tenants
          </h1>
          <p className="text-sm text-muted-foreground">
            Track tenants and upcoming rent due dates (e.g. May 19, Jun 19 each
            month).
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
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
          <Button
            type="button"
            size="sm"
            className="h-8 px-3 text-xs font-medium flex items-center gap-1 bg-emerald-500 text-white hover:bg-emerald-600"
            onClick={() => {
              setAddRoomNo("");
              setShowAddDialog(true);
            }}
          >
            <UserPlus className="h-3 w-3" />
            Add Tenant
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {loadError}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card
            key={card.label}
            className="border border-gray-300 bg-white shadow-sm"
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between pt-0">
              <p className="text-2xl font-semibold tracking-tight">
                {card.value}
              </p>
              <Badge
                variant={card.badgeVariant}
                className="text-[0.7rem]"
              >
                {card.badge}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      {upcomingDue.length > 0 && (
        <Card className="border border-amber-300 bg-amber-50/30 shadow-sm">
          <CardHeader className="pb-2 border-b border-amber-200/80 bg-amber-50/50">
            <div className="flex items-start gap-2">
              <CalendarClock className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Upcoming rent due dates
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Unpaid rent sorted by deadline — highlighted when close to due
                  (e.g. 19th of each month).
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="space-y-2">
              {upcomingDue.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex flex-col gap-1 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between",
                    tenantRowHighlight(t.dueUrgency),
                    t.dueUrgency === "overdue" || t.dueUrgency === "due_today"
                      ? "border-red-200"
                      : t.dueUrgency === "due_soon"
                        ? "border-amber-300"
                        : "border-amber-100 bg-white/80"
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {t.name}{" "}
                      <span className="font-normal text-muted-foreground">
                        · Room {t.roomNo}
                      </span>
                    </p>
                    <p className="text-[0.65rem] text-muted-foreground">
                      {t.dueLabel}
                      {t.nextDueAmount != null &&
                        ` · ₱${t.nextDueAmount.toLocaleString()}`}
                    </p>
                  </div>
                  <DueUrgencyBadge urgency={t.dueUrgency} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800">
                Rooms
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Current tenants, lease periods, and payment status.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Search room or tenant..."
                className="h-8 w-full bg-muted text-xs sm:w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs sm:w-40"
                value={paymentFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setPaymentFilter(e.target.value as PaymentFilter)
                }
              >
                <option value="all">All payments</option>
                <option value="due_soon">Due soon / this week</option>
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
                <TableHead>Room No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Lease Period</TableHead>
                <TableHead>Next rent due</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead className="text-right pr-4 font-semibold text-slate-600">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTenants.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    {loading
                      ? "Loading…"
                      : "No tenants yet. Add a room on the Rooms page, then add a tenant here."}
                  </TableCell>
                </TableRow>
              )}
              {paginatedTenants.map((tenant) => (
                <TableRow
                  key={tenant.id}
                  className={tenantRowHighlight(tenant.dueUrgency)}
                >
                  <TableCell className="text-xs font-mono text-slate-500">
                    {tenant.id.slice(0, 8)}…
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {tenant.roomNo}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-800">
                    {tenant.name}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {tenant.leasePeriod}
                  </TableCell>
                  <TableCell>
                    <DueUrgencyBadge
                      urgency={tenant.dueUrgency}
                      dueLabel={tenant.dueLabel}
                    />
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={tenant.paymentStatus} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-[0.7rem] flex items-center gap-1"
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setEditName(tenant.name);
                          setEditLeaseStart(tenant.leaseStart);
                          setEditLeaseEnd(tenant.leaseEnd);
                          setEditPaymentStatus(tenant.paymentStatus);
                          setEditEmail(tenant.email ?? "");
                          setEditContact(tenant.contact ?? "");
                          setShowEditDialog(true);
                        }}
                      >
                        <PenSquare className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                        onClick={() => {
                          setSelectedTenant(tenant);
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
              Showing {from}–{to} of {filteredTenants.length} tenants
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

      {/* Edit tenant dialog */}
      {showEditDialog && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Edit Tenant
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Update the tenant name, contact details, lease period, or payment status.
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
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <div className="space-y-1">
                <label className="text-[0.75rem] font-medium text-slate-800">
                  Room No.
                </label>
                <Input
                  value={selectedTenant.roomNo}
                  disabled
                  className="h-8 text-xs bg-muted"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[0.75rem] font-medium text-slate-800">
                  Tenant Name
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Contact No.
                  </label>
                  <Input
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Lease start
                  </label>
                  <Input
                    type="date"
                    value={editLeaseStart}
                    onChange={(e) => setEditLeaseStart(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Lease end
                  </label>
                  <Input
                    type="date"
                    value={editLeaseEnd}
                    onChange={(e) => setEditLeaseEnd(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[0.75rem] font-medium text-slate-800">
                  Payment Status
                </label>
                <select
                  className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={editPaymentStatus}
                  onChange={(e) =>
                    setEditPaymentStatus(e.target.value as PaymentStatus)
                  }
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={saving || !selectedTenant}
                  onClick={async () => {
                    if (!selectedTenant) return;
                    setSaving(true);
                    try {
                      const res = await fetch(
                        `/api/landlord/leases/${selectedTenant.id}`,
                        {
                          method: "PATCH",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            tenantName: editName.trim(),
                            leaseStart: editLeaseStart,
                            leaseEnd: editLeaseEnd,
                            paymentStatus: editPaymentStatus,
                            email: editEmail.trim(),
                            phone: editContact.trim(),
                          }),
                        }
                      );
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setShowEditDialog(false);
                      await loadData();
                    } catch (e) {
                      setLoadError(
                        e instanceof Error ? e.message : "Failed to update"
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving…" : "Update"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View details dialog */}
      {showDetailsDialog && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Tenant Details
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Overview of this tenant&apos;s room and payment status.
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
                  {selectedTenant.name}
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Tenant ID:{" "}
                  <span className="font-mono">{selectedTenant.id}</span>
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Room:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedTenant.roomNo}
                  </span>
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Lease period:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedTenant.leasePeriod}
                  </span>
                </p>
                {selectedTenant.email && (
                  <p className="text-[0.7rem] text-muted-foreground">
                    Email:{" "}
                    <span className="font-medium text-slate-900">
                      {selectedTenant.email}
                    </span>
                  </p>
                )}
                {selectedTenant.contact && (
                  <p className="text-[0.7rem] text-muted-foreground">
                    Contact:{" "}
                    <span className="font-medium text-slate-900">
                      {selectedTenant.contact}
                    </span>
                  </p>
                )}
              </div>

              {selectedTenant.monthlySchedule &&
                selectedTenant.monthlySchedule.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[0.75rem] font-semibold text-slate-900">
                      Monthly payments (
                      {selectedTenant.paidMonths ?? 0} /{" "}
                      {selectedTenant.totalMonths ??
                        selectedTenant.monthlySchedule.length}{" "}
                      paid)
                    </p>
                    <div className="max-h-48 overflow-y-auto rounded border text-[0.65rem]">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-2 py-1 text-left">Month</th>
                            <th className="px-2 py-1 text-left">Due</th>
                            <th className="px-2 py-1 text-left">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTenant.monthlySchedule.map((m) => {
                            const isNextUnpaid =
                              m.status !== "Paid" &&
                              selectedTenant.nextDueDate != null &&
                              m.dueDate.slice(0, 10) ===
                                selectedTenant.nextDueDate;
                            return (
                            <tr
                              key={m.monthNumber}
                              className={cn(
                                "border-t",
                                isNextUnpaid &&
                                  "bg-amber-50 font-medium text-amber-900"
                              )}
                            >
                              <td className="px-2 py-1">Month {m.monthNumber}</td>
                              <td className="px-2 py-1">
                                {new Date(m.dueDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="px-2 py-1">
                                {m.status === "Paid" ? "Paid" : "Not Yet Paid"}
                                {isNextUnpaid ? " · Next due" : ""}
                              </td>
                            </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {selectedTenant.dueUrgency &&
                selectedTenant.dueUrgency !== "paid" && (
                  <div
                    className={cn(
                      "rounded-md border px-3 py-2",
                      tenantRowHighlight(selectedTenant.dueUrgency),
                      selectedTenant.dueUrgency === "overdue" ||
                        selectedTenant.dueUrgency === "due_today"
                        ? "border-red-200"
                        : "border-amber-200"
                    )}
                  >
                    <p className="text-[0.75rem] font-semibold text-slate-900 mb-1">
                      Next rent due
                    </p>
                    <DueUrgencyBadge
                      urgency={selectedTenant.dueUrgency}
                      dueLabel={selectedTenant.dueLabel}
                    />
                  </div>
                )}

              <div className="space-y-1">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Payment Status
                </p>
                <PaymentStatusBadge status={selectedTenant.paymentStatus} />
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[0.7rem] text-slate-700">
                <p>
                  Use the <span className="font-semibold">Edit</span> button in
                  the table if you need to adjust the lease or payment status.
                  For more detailed room settings, go to the{" "}
                  <span className="font-semibold">Rooms</span> page.
                </p>
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

      {/* Add tenant dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-lg border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Add Tenant
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Create a new tenant record for one of your rooms.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowAddDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Dorm Name
                  </label>
                  <Input
                    value={propertyName}
                    disabled
                    className="h-8 text-xs bg-muted"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Room (vacant only)
                  </label>
                  <select
                    className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs disabled:opacity-60"
                    value={addRoomNo}
                    onChange={(e) => setAddRoomNo(e.target.value)}
                    disabled={loadingVacantRooms}
                  >
                    <option value="">
                      {loadingVacantRooms
                        ? "Loading rooms…"
                        : vacantRoomNos.length === 0
                          ? "No vacant rooms"
                          : "Select room"}
                    </option>
                    {vacantRoomNos.map((no) => (
                      <option key={no} value={no}>
                        {no}
                      </option>
                    ))}
                  </select>
                  {!loadingVacantRooms && vacantRoomNos.length === 0 && (
                    <p className="text-[0.65rem] text-muted-foreground">
                      Add a room or set one to Available on the Rooms page.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[0.75rem] font-medium text-slate-800">
                  Tenant Name
                </label>
                <Input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="student@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Contact No.
                  </label>
                  <Input
                    value={addContact}
                    onChange={(e) => setAddContact(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="09xx xxx xxxx"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Lease Start Date
                  </label>
                  <Input
                    type="date"
                    value={addStartDate}
                    onChange={(e) => setAddStartDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Lease End Date
                  </label>
                  <Input
                    type="date"
                    value={addEndDate}
                    onChange={(e) => setAddEndDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[0.75rem] font-medium text-slate-800">
                  Payment Status
                </label>
                <select
                  className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={addPaymentStatus}
                  onChange={(e) =>
                    setAddPaymentStatus(e.target.value as PaymentStatus)
                  }
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[0.75rem] font-medium text-slate-800">
                  Remarks
                </label>
                <Input
                  value={addRemarks}
                  onChange={(e) => setAddRemarks(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Optional notes about this tenant or lease"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={
                    saving ||
                    !addRoomNo.trim() ||
                    !addName.trim() ||
                    !addStartDate ||
                    !addEndDate
                  }
                  onClick={async () => {
                    setSaving(true);
                    try {
                      const res = await fetch("/api/landlord/leases", {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          roomNo: addRoomNo.trim(),
                          tenantName: addName.trim(),
                          email: addEmail.trim(),
                          phone: addContact.trim(),
                          leaseStart: addStartDate,
                          leaseEnd: addEndDate,
                          paymentStatus: addPaymentStatus,
                          remarks: addRemarks.trim() || undefined,
                        }),
                      });
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setAddRoomNo("");
                      setAddName("");
                      setAddEmail("");
                      setAddContact("");
                      setAddStartDate("");
                      setAddEndDate("");
                      setAddPaymentStatus("Pending");
                      setAddRemarks("");
                      setShowAddDialog(false);
                      await loadData();
                    } catch (e) {
                      setLoadError(
                        e instanceof Error ? e.message : "Failed to add tenant"
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving…" : "Add"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


