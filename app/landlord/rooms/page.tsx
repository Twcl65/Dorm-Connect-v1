"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { PenSquare, Eye, Settings, Loader2, Trash2 } from "lucide-react";
import { uploadDormConnectFiles } from "@/lib/upload-file-client";

type PaymentStatus = "Paid" | "Pending" | "Overdue";
type RoomStatus = "Occupied" | "Available" | "Reserved" | "Maintenance";

type Room = {
  id: string;
  roomNo: string;
  capacity: number;
  rate: number;
  status: RoomStatus;
  remarks?: string;
  isListed?: boolean;
  listingLocation?: string;
  listingDescription?: string;
  listingImageUrls?: string[];
  listingBackgroundUrl?: string;
  roomImageUrls?: string[];
  roomSizeLabel?: string;
  roomDetails?: string;
  occupants?: string;
};

type LeaseRow = {
  id: string;
  roomId: string;
  roomNo: string;
  name: string;
  leaseStart: string;
  leaseEnd: string;
  leasePeriod: string;
  paymentStatus: PaymentStatus;
  status: RoomStatus;
  reservationStatus?: "Pending" | "Confirmed";
};

const ROWS_PER_PAGE = 5;

type PropertyOption = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  contactPhone: string | null;
  latitude: number | null;
  longitude: number | null;
};

function formatPropertyAddress(p: PropertyOption | undefined): string {
  if (!p) return "";
  const line = [p.address, p.city].filter(Boolean).join(", ").trim();
  return line;
}

/** Prefill listing description from room record (other details + remarks). */
function listingDescriptionFromRoom(room: Room): string {
  const details = room.roomDetails?.trim();
  const remarks = room.remarks?.trim();
  const parts: string[] = [];
  if (details) parts.push(details);
  if (remarks) parts.push(remarks);
  return parts.join("\n\n");
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

function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const colorClasses =
    status === "Occupied"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Available"
        ? "bg-blue-100 text-blue-800"
        : status === "Reserved"
          ? "bg-violet-100 text-violet-800"
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

function PostStatusBadge({ listed }: { listed: boolean }) {
  return (
    <Badge
      className={
        listed
          ? "bg-emerald-100 text-emerald-800 rounded-full px-3 py-1 text-xs font-medium"
          : "bg-slate-100 text-slate-700 rounded-full px-3 py-1 text-xs font-medium"
      }
      variant="outline"
    >
      {listed ? "Posted" : "Not yet posted"}
    </Badge>
  );
}

export default function LandlordRoomsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] =
    useState<PaymentStatus | "all">("all");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [leaseRows, setLeaseRows] = useState<LeaseRow[]>([]);
  const [propertyName, setPropertyName] = useState("");
  const [propertyOptions, setPropertyOptions] = useState<PropertyOption[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [addRoomPropertyId, setAddRoomPropertyId] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    occupied: 0,
    available: 0,
    reserved: 0,
    maintenance: 0,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manageMenuOpen, setManageMenuOpen] = useState(false);

  const [showAddRoomDialog, setShowAddRoomDialog] = useState(false);
  const [newRoomNo, setNewRoomNo] = useState("");
  const [newRoomCapacity, setNewRoomCapacity] = useState("4");
  const [newRoomRate, setNewRoomRate] = useState("4000");
  const [newRoomRemarks, setNewRoomRemarks] = useState("");
  const [newRoomSizeLabel, setNewRoomSizeLabel] = useState("");
  const [newRoomDetails, setNewRoomDetails] = useState("");
  const [newRoomPhotoFiles, setNewRoomPhotoFiles] = useState<File[]>([]);

  const [showUpdateAvailabilityDialog, setShowUpdateAvailabilityDialog] =
    useState(false);
  const [roomToEdit, setRoomToEdit] = useState<Room | null>(null);
  const [editRoomStatus, setEditRoomStatus] =
    useState<RoomStatus>("Available");
  const [showEditRoomDialog, setShowEditRoomDialog] = useState(false);

  const [showPostListingDialog, setShowPostListingDialog] = useState(false);
  const [listingLocation, setListingLocation] = useState("");
  const [listingRoomId, setListingRoomId] = useState("");
  const [listingCapacity, setListingCapacity] = useState("");
  const [listingRate, setListingRate] = useState("");
  const [listingStatus, setListingStatus] = useState<RoomStatus | "">("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingImagesInfo, setListingImagesInfo] = useState<string[]>([]);
  const [listingPhotoFiles, setListingPhotoFiles] = useState<File[]>([]);
  const [listingBackgroundFile, setListingBackgroundFile] = useState<File | null>(
    null
  );
  const [previewRoomImages, setPreviewRoomImages] = useState<string[]>([]);

  const [selectedTenant, setSelectedTenant] = useState<LeaseRow | null>(null);
  const [showTenantEditDialog, setShowTenantEditDialog] = useState(false);
  const [showTenantDetailsDialog, setShowTenantDetailsDialog] = useState(false);
  const [editTenantName, setEditTenantName] = useState("");
  const [editLeaseStart, setEditLeaseStart] = useState("");
  const [editLeaseEnd, setEditLeaseEnd] = useState("");
  const [editTenantPaymentStatus, setEditTenantPaymentStatus] =
    useState<PaymentStatus>("Paid");

  const loadData = useCallback(
    async (propertyIdOverride?: string) => {
      setLoadError(null);
      setLoading(true);
      const pid = (propertyIdOverride ?? selectedPropertyId).trim();
      try {
        const qs = pid
          ? `?propertyId=${encodeURIComponent(pid)}`
          : "";
        const res = await fetch(`/api/landlord/rooms-data${qs}`, {
          credentials: "include",
        });
      const json = (await res.json()) as {
        propertyName?: string;
        selectedPropertyId?: string;
        properties?: PropertyOption[];
        stats?: typeof stats;
        rooms?: Room[];
        leaseRows?: LeaseRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setPropertyName(json.propertyName ?? "");
      if (json.properties?.length) {
        setPropertyOptions(
          json.properties.map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address ?? null,
            city: p.city ?? null,
            contactPhone: p.contactPhone ?? null,
            latitude:
              typeof p.latitude === "number" && !Number.isNaN(p.latitude)
                ? p.latitude
                : null,
            longitude:
              typeof p.longitude === "number" && !Number.isNaN(p.longitude)
                ? p.longitude
                : null,
          }))
        );
      }
      if (json.selectedPropertyId) {
        setSelectedPropertyId(json.selectedPropertyId);
      }
      if (json.stats) setStats(json.stats);
      setRooms(json.rooms ?? []);
      setLeaseRows(json.leaseRows ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId]);

  const addRoomProperty = useMemo(
    () => propertyOptions.find((p) => p.id === addRoomPropertyId),
    [propertyOptions, addRoomPropertyId]
  );

  const selectedProperty = useMemo(
    () => propertyOptions.find((p) => p.id === selectedPropertyId),
    [propertyOptions, selectedPropertyId]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showAddRoomDialog && !showPostListingDialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showAddRoomDialog, showPostListingDialog]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Total Rooms",
        value: String(stats.total),
        badge: "Rooms",
        badgeVariant: "secondary" as const,
      },
      {
        label: "Occupied",
        value: String(stats.occupied),
        badge: "In use",
        badgeVariant: "success" as const,
      },
      {
        label: "Available",
        value: String(stats.available),
        badge: "Vacant",
        badgeVariant: "success" as const,
      },
      {
        label: "Reserved",
        value: String(stats.reserved ?? 0),
        badge: "On hold",
        badgeVariant: "secondary" as const,
      },
      {
        label: "Maintenance",
        value: String(stats.maintenance),
        badge: "Under maintenance",
        badgeVariant: "warning" as const,
      },
    ],
    [stats]
  );

  const filteredRooms = useMemo(
    () =>
      rooms.filter((room) => {
        const lease = leaseRows.find((l) => l.roomId === room.id);
        const q = search.trim().toLowerCase();
        const matchesSearch =
          q.length === 0 ||
          room.roomNo.toLowerCase().includes(q) ||
          room.id.toLowerCase().includes(q) ||
          (lease &&
            lease.name.toLowerCase().includes(q));
        const matchesPayment =
          paymentFilter === "all" ||
          (lease && lease.paymentStatus === paymentFilter);
        return matchesSearch && matchesPayment;
      }),
    [rooms, leaseRows, search, paymentFilter]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRooms.length / ROWS_PER_PAGE)
  );

  const paginatedRooms = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return filteredRooms.slice(start, end);
  }, [filteredRooms, page]);

  const from =
    filteredRooms.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1;
  const to =
    filteredRooms.length === 0
      ? 0
      : Math.min(page * ROWS_PER_PAGE, filteredRooms.length);

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
            Rooms
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage room assignments, leases, and payment status.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              href="/landlord/properties"
              className="text-xs font-medium text-primary underline"
            >
              Property &amp; map settings
            </Link>
            {propertyOptions.length > 0 ? (
              <select
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
              >
                {propertyOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
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

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {loadError}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                variant={card.badgeVariant as any}
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
                Every room; tenant and lease columns show when a lease exists.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Search room or tenant..."
                className="h-8 w-full bg-muted text-xs sm:w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="relative">
                <Button
                  size="sm"
                  type="button"
                  onClick={() => setManageMenuOpen((prev) => !prev)}
                  className="h-8 bg-emerald-500 px-3 text-xs font-medium text-white hover:bg-emerald-600 flex items-center gap-1"
                >
                  <Settings className="h-3 w-3" />
                  Manage Rooms
                </Button>
                {manageMenuOpen && (
                  <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-slate-200 bg-white py-1 text-xs shadow-md">
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                      onClick={() => {
                        setManageMenuOpen(false);
                        setAddRoomPropertyId(
                          selectedPropertyId ||
                            propertyOptions[0]?.id ||
                            ""
                        );
                        setShowAddRoomDialog(true);
                      }}
                    >
                      Add Room
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                      onClick={() => {
                        setManageMenuOpen(false);
                        setShowUpdateAvailabilityDialog(true);
                      }}
                    >
                      Update Availability
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                      onClick={() => {
                        setManageMenuOpen(false);
                        setListingPhotoFiles([]);
                        setListingImagesInfo([]);
                        setListingBackgroundFile(null);
                        setPreviewRoomImages([]);
                        setListingRoomId("");
                        setListingDescription("");
                        const loc =
                          formatPropertyAddress(selectedProperty) ||
                          selectedProperty?.name ||
                          "";
                        setListingLocation(loc);
                        setShowPostListingDialog(true);
                      }}
                    >
                      Post Listing
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Room No.</TableHead>
                  <TableHead>Status</TableHead>
                <TableHead>Post status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Lease Period</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead className="text-right pr-4 font-semibold text-slate-600">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRooms.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    {loading
                      ? "Loading…"
                      : rooms.length === 0
                        ? "No rooms yet. Use Manage Rooms → Add Room."
                        : "No rooms match your search or filters."}
                  </TableCell>
                </TableRow>
              )}
              {paginatedRooms.map((room) => {
                const lease = leaseRows.find((l) => l.roomId === room.id);
                return (
                  <TableRow key={room.id}>
                    <TableCell className="text-xs font-mono text-slate-500">
                      {room.id.slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {room.roomNo}
                    </TableCell>
                    <TableCell>
                      <RoomStatusBadge status={room.status} />
                    </TableCell>
                    <TableCell>
                      <PostStatusBadge listed={Boolean(room.isListed)} />
                    </TableCell>
                    <TableCell className="text-sm font-medium text-slate-800">
                      {room.occupants || lease?.name || (
                        <span className="font-normal text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {lease?.leasePeriod ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lease ? (
                        <PaymentStatusBadge status={lease.paymentStatus} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2 text-[0.7rem] flex items-center gap-1"
                          onClick={() => {
                            setRoomToEdit(room);
                            setEditRoomStatus(room.status);
                            setShowEditRoomDialog(true);
                          }}
                        >
                          <PenSquare className="h-3 w-3" />
                          Room
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[0.7rem] text-red-600 border-red-200 hover:bg-red-50"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Delete room ${room.roomNo}? This cannot be undone.`
                              )
                            )
                              return;
                            setSaving(true);
                            try {
                              const res = await fetch(
                                `/api/landlord/rooms/${room.id}`,
                                { method: "DELETE", credentials: "include" }
                              );
                              const j = (await res.json()) as { error?: string };
                              if (!res.ok) throw new Error(j.error ?? "Failed");
                              await loadData();
                            } catch (e) {
                              setLoadError(
                                e instanceof Error ? e.message : "Delete failed"
                              );
                            } finally {
                              setSaving(false);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        {lease ? (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 px-2 text-[0.7rem]"
                              onClick={() => {
                                setSelectedTenant(lease);
                                setEditTenantName(lease.name);
                                setEditLeaseStart(lease.leaseStart);
                                setEditLeaseEnd(lease.leaseEnd);
                                setEditTenantPaymentStatus(lease.paymentStatus);
                                setShowTenantEditDialog(true);
                              }}
                            >
                              Lease
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                              onClick={() => {
                                setSelectedTenant(lease);
                                setShowTenantDetailsDialog(true);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                          </>
                        ) : (
                          <span className="text-[0.65rem] text-muted-foreground self-center px-1">
                            No lease
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-2 border-t px-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.7rem] text-muted-foreground">
              Showing {from}–{to} of {filteredRooms.length} rooms
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

      {/* Add Room dialog */}
      {showAddRoomDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 pb-6 sm:py-10">
          <Card className="flex max-h-[calc(100vh-5rem)] w-full max-w-4xl flex-col overflow-hidden border border-gray-300 bg-white shadow-lg">
            <CardHeader className="shrink-0 border-b bg-muted/40 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Add Room
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Choose which property this room belongs to. It appears on the
                    student map using that property&apos;s address and map pin.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowAddRoomDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-xs text-slate-800 sm:px-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Property
                  </label>
                  <select
                    className="h-8 w-full max-w-md rounded-md border border-gray-300 bg-white px-2 text-xs"
                    value={addRoomPropertyId}
                    onChange={(e) => setAddRoomPropertyId(e.target.value)}
                    disabled={propertyOptions.length === 0}
                  >
                    {propertyOptions.length === 0 ? (
                      <option value="">No properties yet</option>
                    ) : (
                      propertyOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="text-[0.65rem] text-muted-foreground">
                    The room is stored under this property so browse and map
                    views match the correct building.
                  </p>
                </div>

                {addRoomProperty ? (
                  <div className="space-y-2 md:col-span-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-[0.7rem] text-slate-700">
                    <p className="text-[0.7rem] font-semibold text-slate-900">
                      Location shown to students (from property settings)
                    </p>
                    <p>
                      <span className="text-muted-foreground">Address: </span>
                      {formatPropertyAddress(addRoomProperty) || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Contact: </span>
                      {addRoomProperty.contactPhone?.trim() || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Map pin: </span>
                      {addRoomProperty.latitude != null &&
                      addRoomProperty.longitude != null ? (
                        <>
                          {addRoomProperty.latitude.toFixed(5)},{" "}
                          {addRoomProperty.longitude.toFixed(5)}
                        </>
                      ) : (
                        <span className="text-amber-800">
                          Not set — open{" "}
                          <Link
                            href="/landlord/properties"
                            className="underline font-medium text-primary"
                          >
                            Property &amp; map settings
                          </Link>{" "}
                          to pin this property on the map.
                        </span>
                      )}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Room No.
                  </label>
                  <Input
                    value={newRoomNo}
                    onChange={(e) => setNewRoomNo(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="e.g. 101"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Capacity
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Rate (₱ / month)
                  </label>
                  <Input
                    type="number"
                    min={1000}
                    value={newRoomRate}
                    onChange={(e) => setNewRoomRate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Room size
                  </label>
                  <Input
                    value={newRoomSizeLabel}
                    onChange={(e) => setNewRoomSizeLabel(e.target.value)}
                    className="h-8 text-xs"
                    placeholder="e.g. 12 sqm or 3×4 m"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Room photos (multiple)
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    className="h-8 cursor-pointer text-xs"
                    onChange={(e) =>
                      setNewRoomPhotoFiles(
                        Array.from(e.target.files ?? []).slice(0, 12)
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Other details
                  </label>
                  <Textarea
                    value={newRoomDetails}
                    onChange={(e) => setNewRoomDetails(e.target.value)}
                    rows={2}
                    className="min-h-[52px] resize-y text-xs"
                    placeholder="Amenities, furnishing, notes…"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Remarks
                  </label>
                  <Textarea
                    value={newRoomRemarks}
                    onChange={(e) => setNewRoomRemarks(e.target.value)}
                    rows={2}
                    className="min-h-[52px] resize-y text-xs"
                    placeholder="Optional notes about this room..."
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="shrink-0 justify-end gap-2 border-t bg-muted/30 py-3 sm:px-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setShowAddRoomDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={
                  newRoomNo.trim().length === 0 ||
                  saving ||
                  !addRoomPropertyId ||
                  propertyOptions.length === 0
                }
                onClick={async () => {
                  const pid = addRoomPropertyId.trim();
                  if (!pid) {
                    setLoadError("Select a property for this room.");
                    return;
                  }
                  setSaving(true);
                  try {
                    let roomImageUrls: string[] = [];
                    if (newRoomPhotoFiles.length > 0) {
                      roomImageUrls = await uploadDormConnectFiles(
                        newRoomPhotoFiles
                      );
                    }
                    const res = await fetch("/api/landlord/rooms", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        propertyId: pid,
                        roomNo: newRoomNo.trim(),
                        capacity: Number(newRoomCapacity) || 1,
                        rate: Number(newRoomRate) || 0,
                        remarks: newRoomRemarks.trim() || undefined,
                        status: "Available",
                        roomSizeLabel: newRoomSizeLabel.trim() || undefined,
                        roomDetails: newRoomDetails.trim() || undefined,
                        roomImageUrls:
                          roomImageUrls.length > 0 ? roomImageUrls : undefined,
                      }),
                    });
                    const j = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(j.error ?? "Failed");
                    setNewRoomNo("");
                    setNewRoomCapacity("4");
                    setNewRoomRate("4000");
                    setNewRoomRemarks("");
                    setNewRoomSizeLabel("");
                    setNewRoomDetails("");
                    setNewRoomPhotoFiles([]);
                    setShowAddRoomDialog(false);
                    setSelectedPropertyId(pid);
                    await loadData(pid);
                  } catch (e) {
                    setLoadError(
                      e instanceof Error ? e.message : "Failed to add room"
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving…" : "Add Room"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Update availability dialog */}
      {showUpdateAvailabilityDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-3xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Update Room Availability
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    View all rooms and update their availability status.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowUpdateAvailabilityDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <Table bordered={false}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room No.</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Rate (₱)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Post status</TableHead>
                    <TableHead className="text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="text-xs text-slate-700">
                        {room.roomNo}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {room.capacity}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        ₱{room.rate.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <RoomStatusBadge status={room.status} />
                      </TableCell>
                      <TableCell>
                        <PostStatusBadge listed={Boolean(room.isListed)} />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-[0.7rem] flex items-center gap-1"
                          onClick={() => {
                            setRoomToEdit(room);
                            setEditRoomStatus(room.status);
                            setShowEditRoomDialog(true);
                          }}
                        >
                          <PenSquare className="h-3 w-3" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit single room dialog */}
      {showEditRoomDialog && roomToEdit && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Edit Room {roomToEdit.roomNo}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Update capacity, rate, or availability status.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowEditRoomDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-[0.7rem] font-medium text-slate-800">
                    Capacity
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={roomToEdit.capacity}
                    onChange={(e) =>
                      setRoomToEdit({
                        ...roomToEdit,
                        capacity: Number(e.target.value) || 1
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.7rem] font-medium text-slate-800">
                    Rate (₱ / month)
                  </label>
                  <Input
                    type="number"
                    min={1000}
                    value={roomToEdit.rate}
                    onChange={(e) =>
                      setRoomToEdit({
                        ...roomToEdit,
                        rate: Number(e.target.value) || 0
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.7rem] font-medium text-slate-800">
                    Status
                  </label>
                  <select
                    className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                    value={editRoomStatus}
                    onChange={(e) =>
                      setEditRoomStatus(e.target.value as RoomStatus)
                    }
                  >
                    <option value="Available">Available</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Occupied">Occupied</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowEditRoomDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={saving}
                  onClick={async () => {
                    if (!roomToEdit) return;
                    setSaving(true);
                    try {
                      const res = await fetch(
                        `/api/landlord/rooms/${roomToEdit.id}`,
                        {
                          method: "PATCH",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            capacity: roomToEdit.capacity,
                            rate: roomToEdit.rate,
                            status: editRoomStatus,
                          }),
                        }
                      );
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setShowEditRoomDialog(false);
                      setRoomToEdit(null);
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

      {/* Post listing dialog */}
      {showPostListingDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 pb-6 sm:py-10">
          <Card className="flex max-h-[calc(100vh-5rem)] w-full max-w-4xl flex-col overflow-hidden border border-gray-300 bg-white shadow-lg">
            <CardHeader className="shrink-0 border-b bg-muted/40 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Post Listing
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Publish an available room for students to see.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => {
                    setShowPostListingDialog(false);
                    setListingPhotoFiles([]);
                    setListingImagesInfo([]);
                    setListingBackgroundFile(null);
                    setPreviewRoomImages([]);
                    setListingDescription("");
                    setListingLocation("");
                  }}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-xs text-slate-800 sm:px-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
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
                    Location
                  </label>
                  <Input
                    value={listingLocation}
                    onChange={(e) => setListingLocation(e.target.value)}
                    placeholder="e.g. Near USTP main gate"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Room No.
                  </label>
                  <select
                    className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                    value={listingRoomId}
                    onChange={(e) => {
                      const value = e.target.value;
                      setListingRoomId(value);
                      const room = rooms.find((r) => r.id === value);
                      if (room) {
                        setListingCapacity(String(room.capacity));
                        setListingRate(String(room.rate));
                        setListingStatus(room.status);
                        setPreviewRoomImages(room.roomImageUrls ?? []);
                        setListingDescription(listingDescriptionFromRoom(room));
                      } else {
                        setListingCapacity("");
                        setListingRate("");
                        setListingStatus("");
                        setPreviewRoomImages([]);
                        setListingDescription("");
                      }
                    }}
                  >
                    <option value="">Select available room</option>
                    {rooms
                      .filter((room) => room.status === "Available")
                      .map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.roomNo}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Capacity / Rate / Status
                  </label>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[0.7rem]">
                    <p>
                      Capacity:{" "}
                      <span className="font-semibold">
                        {listingCapacity || "—"}
                      </span>
                    </p>
                    <p>
                      Rate:{" "}
                      <span className="font-semibold">
                        {listingRate
                          ? `₱${Number(listingRate).toLocaleString()} / month`
                          : "—"}
                      </span>
                    </p>
                    <p>
                      Status:{" "}
                      <span className="font-semibold">
                        {listingStatus || "—"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Description
                  </label>
                  <p className="text-[0.65rem] text-muted-foreground -mt-0.5 mb-1">
                    Filled from the room&apos;s &quot;Other details&quot; and
                    &quot;Remarks&quot; when you pick a room. Edit as needed.
                  </p>
                  <Textarea
                    value={listingDescription}
                    onChange={(e) => setListingDescription(e.target.value)}
                    rows={3}
                    className="min-h-[72px] resize-y text-xs"
                    placeholder="Select a room to pull details, or type your listing text…"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Listing background (cover)
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    className="h-8 cursor-pointer text-xs"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setListingBackgroundFile(f);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Extra listing photos (optional)
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    className="h-8 cursor-pointer text-xs"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []).slice(0, 4);
                      setListingPhotoFiles(files);
                      setListingImagesInfo(files.map((file) => file.name));
                    }}
                  />
                  <p className="text-[0.65rem] text-muted-foreground">
                    Added to room photos (up to 4).
                  </p>
                  {listingImagesInfo.length > 0 && (
                    <ul className="mt-1 list-disc pl-4 text-[0.65rem] text-slate-700">
                      {listingImagesInfo.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-[0.75rem] font-medium text-slate-800">
                    Accreditation & Safety
                  </label>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[0.7rem] md:inline-block md:min-w-[240px]">
                    <p>
                      Accreditation:{" "}
                      <span className="font-semibold text-emerald-700">
                        Complied
                      </span>
                    </p>
                    <p>
                      Safety compliance:{" "}
                      <span className="font-semibold text-emerald-700">
                        Complied
                      </span>
                    </p>
                  </div>
                </div>

                {listingRoomId && previewRoomImages.length > 0 && (
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[0.75rem] font-medium text-slate-800">
                      Room images (from room record)
                    </label>
                    <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                      {previewRoomImages.map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt=""
                          className="h-20 w-28 rounded border object-cover"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="shrink-0 justify-end gap-2 border-t bg-muted/30 py-3 sm:px-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => {
                  setShowPostListingDialog(false);
                  setListingPhotoFiles([]);
                  setListingImagesInfo([]);
                  setListingBackgroundFile(null);
                  setPreviewRoomImages([]);
                  setListingDescription("");
                  setListingLocation("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 px-3 text-xs"
                disabled={
                  !listingRoomId ||
                  !listingLocation?.trim() ||
                  !listingDescription?.trim() ||
                  saving
                }
                onClick={async () => {
                  setSaving(true);
                  try {
                    const selected = rooms.find((r) => r.id === listingRoomId);
                    const baseRoom = selected?.roomImageUrls ?? [];
                    let extra: string[] = [];
                    if (listingPhotoFiles.length > 0) {
                      extra = await uploadDormConnectFiles(listingPhotoFiles);
                    }
                    const merged = [...new Set([...baseRoom, ...extra])];
                    let listingBackgroundUrl: string | null = null;
                    if (listingBackgroundFile) {
                      const [bg] = await uploadDormConnectFiles([
                        listingBackgroundFile,
                      ]);
                      listingBackgroundUrl = bg;
                    }
                    const payload: Record<string, unknown> = {
                      isListed: true,
                      listingLocation: listingLocation.trim(),
                      listingDescription: listingDescription.trim(),
                      listingImageUrls: merged,
                    };
                    if (listingBackgroundUrl) {
                      payload.listingBackgroundUrl = listingBackgroundUrl;
                    }
                    const res = await fetch(
                      `/api/landlord/rooms/${listingRoomId}`,
                      {
                        method: "PATCH",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      }
                    );
                    const j = (await res.json()) as { error?: string };
                    if (!res.ok) throw new Error(j.error ?? "Failed");
                    setShowPostListingDialog(false);
                    setListingLocation("");
                    setListingRoomId("");
                    setListingCapacity("");
                    setListingRate("");
                    setListingStatus("");
                    setListingDescription("");
                    setListingImagesInfo([]);
                    setListingPhotoFiles([]);
                    setListingBackgroundFile(null);
                    setPreviewRoomImages([]);
                    await loadData();
                  } catch (e) {
                    setLoadError(
                      e instanceof Error ? e.message : "Failed to post listing"
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving…" : "Post Listing"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Tenant edit dialog */}
      {showTenantEditDialog && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Edit Tenant / Lease
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Update basic information for this room reservation.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowTenantEditDialog(false)}
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
                  value={editTenantName}
                  onChange={(e) => setEditTenantName(e.target.value)}
                  className="h-8 text-xs"
                />
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
                  value={editTenantPaymentStatus}
                  onChange={(e) =>
                    setEditTenantPaymentStatus(
                      e.target.value as PaymentStatus
                    )
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
                  onClick={() => setShowTenantEditDialog(false)}
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
                            tenantName: editTenantName.trim(),
                            leaseStart: editLeaseStart,
                            leaseEnd: editLeaseEnd,
                            paymentStatus: editTenantPaymentStatus,
                          }),
                        }
                      );
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setShowTenantEditDialog(false);
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

      {/* Tenant view details dialog */}
      {showTenantDetailsDialog && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Room & Tenant Details
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Quick overview of this room, tenant, and payment status.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowTenantDetailsDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  Room {selectedTenant.roomNo}
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Tenant:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedTenant.name}
                  </span>
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Lease period:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedTenant.leasePeriod}
                  </span>
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Status
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[0.7rem] text-muted-foreground">
                    Room:
                  </span>
                  <RoomStatusBadge status={selectedTenant.status} />
                </div>
                {selectedTenant.reservationStatus ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[0.7rem] text-muted-foreground">
                      Reservation:
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        selectedTenant.reservationStatus === "Confirmed"
                          ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] text-emerald-800"
                          : "rounded-full bg-violet-50 px-2 py-0.5 text-[0.65rem] text-violet-800"
                      }
                    >
                      {selectedTenant.reservationStatus === "Confirmed"
                        ? "Booked (confirmed)"
                        : "Reserved (pending)"}
                    </Badge>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <span className="text-[0.7rem] text-muted-foreground">
                    Payment:
                  </span>
                  <PaymentStatusBadge status={selectedTenant.paymentStatus} />
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[0.7rem] text-slate-700">
                <p>
                  Use <span className="font-semibold">Lease</span> to edit dates
                  and payment status, or <span className="font-semibold">Room</span>{" "}
                  for capacity and availability.
                </p>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowTenantDetailsDialog(false)}
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

