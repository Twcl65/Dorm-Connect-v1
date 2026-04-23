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
import { Eye, Loader2 } from "lucide-react";

type RoomStatus = "Occupied" | "Available" | "Maintenance";
type PaymentStatus = "Up to Date" | "Overdue" | "Pending";

type Overview = {
  propertiesCount: number;
  rooms: {
    total: number;
    occupied: number;
    available: number;
    maintenance: number;
  };
  reservations: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
  };
  paymentsThisMonth: string;
  accreditation: { approved: number; pending: number };
  activities: { description: string; time: string }[];
  roomsPreview: {
    id: string;
    roomNo: string;
    capacity: number;
    rate: string;
    status: RoomStatus;
  }[];
  tenantsPreview: {
    id: string;
    roomNo: string;
    name: string;
    leasePeriod: string;
    paymentStatus: PaymentStatus;
  }[];
};

function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const colorClasses =
    status === "Occupied"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Available"
        ? "bg-blue-100 text-blue-800"
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

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const colorClasses =
    status === "Up to Date"
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

export default function LandlordDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomFilter, setRoomFilter] = useState<RoomStatus | "all">("all");
  const [selectedTenant, setSelectedTenant] = useState<
    Overview["tenantsPreview"][number] | null
  >(null);
  const [showTenantDialog, setShowTenantDialog] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/landlord/overview", {
        credentials: "include",
      });
      const json = (await res.json()) as Overview & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: "Properties",
        value: String(data.propertiesCount),
        badge: "Owned",
        badgeVariant: "secondary" as const,
      },
      {
        label: "Payments received (this month)",
        value: data.paymentsThisMonth,
        badge: "Paid records",
        badgeVariant: "success" as const,
      },
      {
        label: "Reservations",
        value: String(data.reservations.total),
        badge: `${data.reservations.confirmed} confirmed`,
        badgeVariant: "warning" as const,
      },
      {
        label: "Accreditation",
        value: `${data.accreditation.approved} approved\n${data.accreditation.pending} in progress`,
        badge: "Requests",
        badgeVariant: "muted" as const,
      },
    ];
  }, [data]);

  const filteredRooms = useMemo(() => {
    if (!data) return [];
    return data.roomsPreview.filter(
      (room) => roomFilter === "all" || room.status === roomFilter
    );
  }, [data, roomFilter]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Landlord Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Snapshot of occupancy, reservations, payments, and tenant activity.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          type="button"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {summaryCards.map((card) => (
              <Card
                key={card.label}
                className="border border-gray-300 bg-white shadow-sm"
              >
                <CardHeader className="pb-1 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {card.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-end justify-between pt-0">
                  <p className="text-xl font-semibold tracking-tight whitespace-pre-line leading-tight">
                    {card.value}
                  </p>
                  <Badge variant={card.badgeVariant} className="text-[0.7rem]">
                    {card.badge}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border border-gray-300 bg-white">
            <CardHeader className="pb-3 border-b bg-muted/40">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    Rooms
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Overview of room capacity, rates, and occupancy.
                  </p>
                </div>
                <div>
                  <select
                    className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
                    value={roomFilter}
                    onChange={(e) =>
                      setRoomFilter(
                        e.target.value === "all"
                          ? "all"
                          : (e.target.value as RoomStatus)
                      )
                    }
                  >
                    <option value="all">All statuses</option>
                    <option value="Occupied">Occupied</option>
                    <option value="Available">Available</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {filteredRooms.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No rooms yet. Add rooms under{" "}
                  <span className="font-medium">Rooms</span>.
                </p>
              ) : (
                <Table bordered={false}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Room No.</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRooms.map((room) => (
                      <TableRow key={room.id}>
                        <TableCell className="text-xs font-mono text-slate-500">
                          {room.id.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="text-sm font-medium text-slate-800">
                          {room.roomNo}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">
                          {room.capacity}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">
                          {room.rate}
                        </TableCell>
                        <TableCell>
                          <RoomStatusBadge status={room.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border border-gray-300 bg-white">
          <CardHeader className="pb-3 border-b bg-muted/40">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            {!data?.activities.length ? (
              <p className="text-xs text-muted-foreground">
                Activity will appear when you manage rooms, tenants, and
                payments.
              </p>
            ) : (
              <ul className="space-y-2 text-xs text-slate-700">
                {data.activities.map((item, idx) => (
                  <li
                    key={`${item.time}-${idx}`}
                    className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <p className="font-medium text-slate-800">
                      {item.description}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      {item.time}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <CardTitle className="text-sm font-semibold text-slate-800">
            Tenants
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {!data?.tenantsPreview.length ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No tenant leases yet.
            </p>
          ) : (
            <Table bordered={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Room No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Lease Period</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead className="text-right pr-4 font-semibold text-slate-600">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.tenantsPreview.map((tenant) => (
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
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setShowTenantDialog(true);
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
          )}
        </CardContent>
      </Card>

      {showTenantDialog && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Tenant Overview
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Quick view — edit on Tenants page.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowTenantDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <p className="text-sm font-semibold text-slate-900">
                {selectedTenant.name}
              </p>
              <p className="text-[0.7rem] text-muted-foreground">
                Lease: {selectedTenant.leasePeriod}
              </p>
              <PaymentStatusBadge status={selectedTenant.paymentStatus} />
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowTenantDialog(false)}
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
