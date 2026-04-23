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
import { PenSquare, Eye, UserPlus, Loader2 } from "lucide-react";

type PaymentStatus = "Paid" | "Pending" | "Overdue";

type Tenant = {
  id: string;
  roomNo: string;
  name: string;
  leaseStart: string;
  leaseEnd: string;
  leasePeriod: string;
  paymentStatus: PaymentStatus;
  email?: string;
  contact?: string;
};

const ROWS_PER_PAGE = 5;

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
  const [paymentFilter, setPaymentFilter] =
    useState<PaymentStatus | "all">("all");
  const [tenantsData, setTenantsData] = useState<Tenant[]>([]);
  const [propertyName, setPropertyName] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    activeLeases: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
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
        stats?: typeof stats;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setPropertyName(json.propertyName ?? "");
      setTenantsData(json.leases ?? []);
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
        label: "Pending / Overdue",
        value: `${stats.pending} / ${stats.overdue}`,
        badge: "Attention",
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
          paymentFilter === "all" ||
          tenant.paymentStatus === paymentFilter;
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
            Track tenant details and payment status.
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
                  setPaymentFilter(
                    e.target.value === "all"
                      ? "all"
                      : (e.target.value as PaymentStatus)
                  )
                }
              >
                <option value="all">All payments</option>
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
                    colSpan={6}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    {loading
                      ? "Loading…"
                      : "No tenants yet. Add a room on the Rooms page, then add a tenant here."}
                  </TableCell>
                </TableRow>
              )}
              {paginatedTenants.map((tenant) => (
                <TableRow key={tenant.id}>
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

