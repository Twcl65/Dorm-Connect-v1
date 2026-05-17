"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";
import { spreadOverlappingMarkers } from "@/lib/spread-map-markers";
import type { StudentMapMarker } from "@/components/maps/student-properties-map";

const StudentDormMap = dynamic(
  () =>
    import("@/components/maps/student-properties-map").then((m) => ({
      default: m.StudentDormMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(55vh,420px)] w-full items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading map…
      </div>
    ),
  }
);

function normWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Avoid showing room "other details" twice when already part of the listing description. */
function showRoomDetailsAside(
  description: string,
  roomDetails: string | null | undefined
): boolean {
  if (!roomDetails?.trim()) return false;
  return !normWs(description).includes(normWs(roomDetails));
}

type DormReview = {
  author: string;
  date: string;
  comment: string;
  rating: number;
};

type Dorm = {
  id: string;
  name: string;
  price: number;
  location: string;
  amenities: string[];
  documentType: string;
  description: string;
  distance: string;
  landlord: string;
  roomType: string;
  capacity: string;
  roomSizeLabel?: string | null;
  roomDetails?: string | null;
  images: string[];
  reviewSummary: { avg: number | null; count: number };
  myReservationStatus?: "Pending" | "Confirmed" | null;
  propertyId: string;
  propertyName: string;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyContactPhone: string | null;
  propertyDescription: string | null;
  propertyCoverImageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
};

/** Same source as /api/student/map-properties — one row per bookable property (not UI-filtered). */
type MapPropertyPin = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
};

export default function StudentBrowseDormsPage() {
  const [listings, setListings] = useState<Dorm[]>([]);
  const [mapPins, setMapPins] = useState<MapPropertyPin[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [draftMaxPrice, setDraftMaxPrice] = useState("6000");
  /** Property whose rooms are shown in the map-click dialog (null = closed). */
  const [roomsDialogPropertyId, setRoomsDialogPropertyId] = useState<
    string | null
  >(null);
  const [selectedDorm, setSelectedDorm] = useState<Dorm | null>(null);
  const [showDormDialog, setShowDormDialog] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [reservationStep, setReservationStep] = useState<1 | 2 | 3>(1);
  const [moveInDate, setMoveInDate] = useState("");
  const [leaseDuration, setLeaseDuration] = useState("12");
  const [dialogReviews, setDialogReviews] = useState<DormReview[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [ictVerificationStatus, setIctVerificationStatus] = useState<
    string | null
  >(null);

  const loadListings = useCallback(async () => {
    setListError(null);
    setListLoading(true);
    try {
      const [resList, resMap] = await Promise.all([
        fetch("/api/student/listings", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/student/map-properties", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);
      const listJson = (await resList.json()) as {
        listings?: Dorm[];
        error?: string;
      };
      const mapJson = (await resMap.json()) as {
        properties?: {
          id: string;
          name: string;
          address: string;
          latitude: number;
          longitude: number;
          coverImageUrl: string | null;
        }[];
        error?: string;
      };
      if (!resList.ok) throw new Error(listJson.error ?? "Failed to load");
      setListings(listJson.listings ?? []);
      if (resMap.ok && Array.isArray(mapJson.properties)) {
        const pins: MapPropertyPin[] = [];
        for (const p of mapJson.properties) {
          const latitude = Number(p.latitude);
          const longitude = Number(p.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
          pins.push({
            id: p.id,
            name: p.name,
            address: p.address,
            latitude,
            longitude,
            coverImageUrl: p.coverImageUrl?.trim() || null,
          });
        }
        setMapPins(pins);
      } else {
        setMapPins([]);
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load");
      setListings([]);
      setMapPins([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const json = (await res.json()) as {
          user?: { ictVerificationStatus?: string | null };
        };
        if (!cancelled) {
          setIctVerificationStatus(
            json.user?.ictVerificationStatus ?? null
          );
        }
      } catch {
        if (!cancelled) setIctVerificationStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canBook = ictVerificationStatus === "Verified";

  useEffect(() => {
    if (!showDormDialog || !selectedDorm) {
      setDialogReviews([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/student/reviews?roomId=${selectedDorm.id}`,
          { credentials: "include" }
        );
        const json = (await res.json()) as { reviews?: DormReview[] };
        if (!cancelled) setDialogReviews(json.reviews ?? []);
      } catch {
        if (!cancelled) setDialogReviews([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showDormDialog, selectedDorm?.id]);

  useEffect(() => {
    if (!showDormDialog) setLightboxUrl(null);
  }, [showDormDialog]);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxUrl]);

  useEffect(() => {
    if (!roomsDialogPropertyId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [roomsDialogPropertyId]);

  useEffect(() => {
    if (!roomsDialogPropertyId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRoomsDialogPropertyId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [roomsDialogPropertyId]);

  const filteredDorms = useMemo(
    () =>
      listings.filter((dorm) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          q.length === 0 ||
          dorm.name.toLowerCase().includes(q) ||
          dorm.propertyName.toLowerCase().includes(q) ||
          dorm.location.toLowerCase().includes(q);

        const loc = dorm.location.toLowerCase();
        const matchesLocation =
          locationFilter === "all" ||
          (locationFilter === "ustp" &&
            (loc.includes("ustp") || loc.includes("gate"))) ||
          (locationFilter === "kauswagan" && loc.includes("kauswagan")) ||
          (locationFilter === "downtown" && loc.includes("downtown"));

        const matchesDoc =
          docTypeFilter === "all" || dorm.documentType === docTypeFilter;

        const matchesPrice =
          maxPrice == null || dorm.price <= maxPrice;

        return (
          matchesSearch && matchesLocation && matchesDoc && matchesPrice
        );
      }),
    [listings, search, locationFilter, docTypeFilter, maxPrice]
  );

  /** Pins from map-properties API (accredited + coords + has listed room). Not narrowed by browse UI filters. */
  const mapMarkers = useMemo((): StudentMapMarker[] => {
    const raw: StudentMapMarker[] = mapPins.map((p) => ({
      id: p.id,
      name: p.name,
      latitude: p.latitude,
      longitude: p.longitude,
      coverImageUrl: p.coverImageUrl,
    }));
    return spreadOverlappingMarkers(raw);
  }, [mapPins]);

  /** All listed rooms for the clicked property (full listings), so filters do not hide dialog content. */
  const roomsInPropertyDialog = useMemo(() => {
    const pid = roomsDialogPropertyId?.trim();
    if (!pid) return [];
    return listings.filter((d) => d.propertyId === pid);
  }, [listings, roomsDialogPropertyId]);

  const dialogPropertyPin = useMemo(() => {
    const pid = roomsDialogPropertyId?.trim();
    if (!pid) return null;
    return mapPins.find((p) => p.id === pid) ?? null;
  }, [mapPins, roomsDialogPropertyId]);

  return (
    <div className="space-y-6">
      {ictVerificationStatus &&
        ictVerificationStatus !== "Verified" && (
          <div
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            role="status"
          >
            {ictVerificationStatus === "Pending Verification"
              ? "Your account is pending ICT verification. You can browse listings, but reservation is available only after verification."
              : "Your registration was not approved by ICT. You can browse, but you cannot reserve a room."}
          </div>
        )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Browse Dormitories
          </h1>
          <p className="text-sm text-muted-foreground">
            Each <span className="font-medium text-slate-800">Show all properties</span> button refreshes the list of available rooms. Click a property to see its rooms.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => void loadListings()}
            disabled={listLoading}
          >
            {listLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
      </div>

      {listError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {listError}
        </div>
      )}

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <CardTitle className="text-sm font-semibold text-slate-800">
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search dorm name or keyword..."
                className="h-8 text-xs bg-muted"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                className="h-8 px-3 text-xs bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => {
                  setDraftMaxPrice(maxPrice?.toString() ?? "6000");
                  setShowPriceDialog(true);
                }}
              >
                Set Price Range
              </Button>
            </div>
            <select
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="all">All locations</option>
              <option value="ustp">Near USTP</option>
              <option value="kauswagan">Kauswagan</option>
              <option value="downtown">Downtown</option>
            </select>
            <select
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs"
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
            >
              <option value="all">All document types</option>
              <option value="Accredited">Accredited</option>
              <option value="For Accreditation">For Accreditation</option>
            </select>
          </div>

          <div className="space-y-1">
            <p className="text-[0.7rem] text-muted-foreground">
              Price filter:{" "}
              {maxPrice == null
                ? "Any price"
                : `Up to ₱${maxPrice.toLocaleString()} / month`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-300 bg-white overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <CardTitle className="text-base font-semibold text-slate-800">
            Dorm locations
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tap a pin to view rooms at that property. Names are shown on each pin.
          </p>
        </CardHeader>
        <CardContent className="relative space-y-3 p-4 pt-4 sm:p-5">
          {listLoading ? (
            <div className="flex h-[min(75vh,820px)] min-h-[480px] w-full items-center justify-center rounded-lg border bg-muted/30">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : mapMarkers.length === 0 ? (
            <div className="flex min-h-[480px] h-[min(75vh,820px)] items-center justify-center rounded-lg border border-dashed bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
              {listings.length === 0 ? (
                <>
                  No listed rooms yet. Landlords post listings from{" "}
                  <span className="font-medium text-slate-700">Rooms</span>; each
                  property needs accreditation and a map pin under{" "}
                  <span className="font-medium text-slate-700">Properties</span>.
                </>
              ) : (
                <>
                  No map pins returned. Each property needs coordinates in{" "}
                  <span className="font-medium text-slate-700">
                    Property &amp; map settings
                  </span>
                  , accreditation approved, and at least one listed available room.
                </>
              )}
            </div>
          ) : (
            <div className="h-[min(75vh,820px)] min-h-[480px] w-full">
              <StudentDormMap
                markers={mapMarkers}
                onMarkerClick={(propertyId) => {
                  setRoomsDialogPropertyId(propertyId);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {roomsDialogPropertyId ? (
        <div
          className="fixed inset-0 z-[40] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="browse-property-dialog-title"
          aria-describedby={
            roomsInPropertyDialog[0] || dialogPropertyPin
              ? "browse-property-dialog-location"
              : undefined
          }
          onClick={() => setRoomsDialogPropertyId(null)}
        >
          <Card
            className="my-auto w-full max-w-4xl border border-gray-300 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="border-b bg-muted/40">
              <div className="flex items-start justify-between gap-0 mb-0 pb-0">
                <CardTitle
                  id="browse-property-dialog-title"
                  className="text-base font-semibold leading-snug text-slate-900"
                ><p className="text-xs font-normal leading-snug text-slate-900">Dormitory Name:</p>
                  {roomsInPropertyDialog[0]?.propertyName ??
                    dialogPropertyPin?.name ??
                    "Dormitory"}
                             <div className="mt-0 space-y-1">
                <p
                  id="browse-property-dialog-location"
                  className="text-xs leading-relaxed text-slate-700"
                >
                  {roomsInPropertyDialog[0]
                    ? [
                        roomsInPropertyDialog[0].propertyAddress,
                        roomsInPropertyDialog[0].propertyCity,
                      ]
                        .filter(Boolean)
                        .join(", ") || roomsInPropertyDialog[0].location
                    : dialogPropertyPin?.address && dialogPropertyPin.address !== "—"
                      ? dialogPropertyPin.address
                      : "—"}
                </p>
              </div>
                </CardTitle>
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  onClick={() => setRoomsDialogPropertyId(null)}
                >
                  Close
                </Button>
              </div>
     
            </CardHeader>
            <CardContent className="max-h-[min(60vh,800px)] space-y-2 overflow-y-auto pt-2 text-xs">
              
              {roomsInPropertyDialog.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-200 bg-muted/30 px-3 py-6 text-center text-muted-foreground">
                  No listed rooms for this property in browse results yet. The
                  landlord can post a room listing from{" "}
                  <span className="font-medium text-slate-700">Rooms</span> for this
                  building.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {roomsInPropertyDialog.map((dorm) => (
                    <Card
                      key={dorm.id}
                      className="flex flex-col overflow-hidden border border-gray-300 bg-white"
                    >
                      <div className="relative aspect-[4/2] w-full shrink-0 overflow-hidden bg-slate-200">
                        {dorm.images[0] || dorm.propertyCoverImageUrl ? (
                          <img
                            src={
                              dorm.images[0] ??
                              dorm.propertyCoverImageUrl ??
                              ""
                            }
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full min-h-[4.5rem] w-full items-center justify-center text-[0.65rem] text-muted-foreground">
                            No photo
                          </div>
                        )}
                      </div>
                      <CardContent className="flex flex-1 flex-col gap-0 p-3 pt-2">
                        <p className="line-clamp-2 font-semibold leading-tight text-slate-900">
                          {dorm.name}
                        </p>
                        <p className="line-clamp-2 text-[0.65rem] leading-snug text-muted-foreground">
                          {dorm.location}
                        </p>
                        <p className="font-semibold tabular-nums text-orange-600">
                          ₱{dorm.price.toLocaleString()}
                          <span className="text-[0.65rem] font-normal text-slate-600">
                            {" "}
                            / month
                          </span>
                        </p>
                        {dorm.reviewSummary.count > 0 &&
                        dorm.reviewSummary.avg != null ? (
                          <p className="text-[0.65rem] text-amber-700">
                            ★ {dorm.reviewSummary.avg.toFixed(1)} (
                            {dorm.reviewSummary.count})
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-1">
                          {dorm.amenities.slice(0, 4).map((amenity) => (
                            <Badge
                              key={amenity}
                              variant="muted"
                              className="px-1.5 py-0 text-[0.6rem]"
                            >
                              {amenity}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 pt-3">
                          {dorm.myReservationStatus === "Pending" ? (
                            <Button
                              type="button"
                              className="h-8 w-full text-xs"
                              size="sm"
                              variant="secondary"
                              disabled
                            >
                              Sent booking request
                            </Button>
                          ) : dorm.myReservationStatus === "Confirmed" ? (
                            <Button
                              type="button"
                              className="h-8 w-full text-xs"
                              size="sm"
                              variant="secondary"
                              disabled
                            >
                              Booking confirmed
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              className="h-8 w-full bg-orange-500 text-xs font-semibold text-white hover:bg-orange-600"
                              size="sm"
                              onClick={() => {
                                setSelectedDorm(dorm);
                                setSubmitError(null);
                                setRoomsDialogPropertyId(null);
                                setShowTermsDialog(true);
                              }}
                            >
                              Book Now
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {showTermsDialog && selectedDorm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-lg border border-gray-300 bg-white max-h-[85vh] overflow-y-auto">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <CardTitle className="text-sm font-semibold">
                Terms & conditions
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Please read before booking {selectedDorm.name}.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-700">
              <ul className="list-disc space-y-2 pl-4">
                <li>
                  Reservations are requests until the landlord confirms availability
                  and terms.
                </li>
                <li>
                  Rent, deposits, and utilities follow the landlord&apos;s policy
                  and your signed lease.
                </li>
                <li>
                  Misrepresentation or policy violations may result in cancellation.
                </li>
                <li>
                  DormConnect facilitates booking; the lease is between you and the
                  landlord.
                </li>
                <li>
            Tenants may be removed <strong>five (5) calendar days</strong> after a
            payment due date if the balance remains unpaid, subject to applicable
            school rules and written notice where required.
          </li>
                <li>
                  By continuing you agree to follow house rules and quiet hours as
                  posted on site.
                </li>
              </ul>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setShowTermsDialog(false);
                    setSelectedDorm(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setShowTermsDialog(false);
                    setReservationStep(1);
                    setMoveInDate("");
                    setLeaseDuration("12");
                    setShowDormDialog(true);
                  }}
                >
                  I agree — continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showPriceDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-sm border border-gray-300 bg-white">
            <CardHeader>
              <CardTitle className="text-sm">
                Set Maximum Monthly Price
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="max-price"
                  className="text-[0.75rem] font-medium text-slate-700"
                >
                  Max price (₱)
                </label>
                <Input
                  id="max-price"
                  type="number"
                  min={1000}
                  max={50000}
                  step={100}
                  value={draftMaxPrice}
                  onChange={(e) => setDraftMaxPrice(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowPriceDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    const parsed = Number(draftMaxPrice);
                    if (!Number.isNaN(parsed) && parsed > 0) {
                      setMaxPrice(parsed);
                    } else {
                      setMaxPrice(null);
                    }
                    setShowPriceDialog(false);
                  }}
                >
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showDormDialog && selectedDorm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-4xl border border-gray-300 bg-white max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    {reservationStep === 1 && selectedDorm.name}
                    {reservationStep === 2 && "Rental Terms Summary"}
                    {reservationStep === 3 && "Confirm Reservation"}
                  </CardTitle>
                  {reservationStep === 1 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedDorm.location} • {selectedDorm.distance}
                    </p>
                  )}
                  {reservationStep === 2 && (
                    <p className="text-xs text-muted-foreground">
                      Review the rental terms before continuing.
                    </p>
                  )}
                  {reservationStep === 3 && (
                    <p className="text-xs text-muted-foreground">
                      Choose your move-in date and lease duration.
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => {
                    setShowDormDialog(false);
                    setReservationStep(1);
                  }}
                >
                  Close
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-3">
              {submitError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {submitError}
                </div>
              )}

              {reservationStep === 1 && (
                <>
                  <div className="grid gap-4 md:grid-cols-[2fr,1.3fr]">
                    <div className="space-y-2">
                      <button
                        type="button"
                        className="group relative h-52 w-full overflow-hidden rounded-md bg-slate-200 text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
                        onClick={() =>
                          setLightboxUrl(
                            selectedDorm.images[0] ??
                              selectedDorm.propertyCoverImageUrl ??
                              null
                          )
                        }
                        aria-label="View cover photo larger"
                      >
                        {selectedDorm.images[0] ||
                        selectedDorm.propertyCoverImageUrl ? (
                          <img
                            src={
                              selectedDorm.images[0] ??
                              selectedDorm.propertyCoverImageUrl ??
                              ""
                            }
                            alt={selectedDorm.name}
                            className="h-full w-full object-cover transition duration-200 group-hover:brightness-[0.97]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                            No photo
                          </div>
                        )}
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-2 text-[0.65rem] font-medium text-white opacity-0 transition group-hover:opacity-100">
                          Click to enlarge
                        </span>
                      </button>
                      {selectedDorm.images.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDorm.images.slice(1).map((src) => (
                            <button
                              key={src}
                              type="button"
                              className="relative h-16 w-24 overflow-hidden rounded border border-slate-200 outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-primary"
                              onClick={() => setLightboxUrl(src)}
                              aria-label="View photo larger"
                            >
                              <img
                                src={src}
                                alt=""
                                className="h-full w-full object-cover transition hover:brightness-95"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 text-sm text-slate-700">
                      <p className="text-lg font-semibold text-primary">
                        ₱{selectedDorm.price.toLocaleString()}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          / month
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Managed by{" "}
                        <span className="font-medium text-slate-900">
                          {selectedDorm.landlord}
                        </span>
                      </p>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 space-y-1.5">
                        
                        <p>
                          <span className="text-muted-foreground">Building: </span>
                          {selectedDorm.propertyName}
                        </p>
                        {(selectedDorm.propertyAddress ||
                          selectedDorm.propertyCity) && (
                          <p>
                            <span className="text-muted-foreground">Address: </span>
                            {[
                              selectedDorm.propertyAddress,
                              selectedDorm.propertyCity,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                        {selectedDorm.propertyContactPhone ? (
                          <p>
                            <span className="text-muted-foreground">Contact: </span>
                            {selectedDorm.propertyContactPhone}
                          </p>
                        ) : null}
                        {selectedDorm.propertyDescription ? (
                          <p className="whitespace-pre-line border-t border-slate-200 pt-2 text-[0.7rem] leading-relaxed">
                            {selectedDorm.propertyDescription}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Room type:{" "}
                        <span className="font-medium text-slate-900">
                          {selectedDorm.roomType}
                        </span>
                        <br />
                        Capacity:{" "}
                        <span className="font-medium text-slate-900">
                          {selectedDorm.capacity}
                        </span>
                        {selectedDorm.roomSizeLabel ? (
                          <>
                            <br />
                            Size:{" "}
                            <span className="font-medium text-slate-900">
                              {selectedDorm.roomSizeLabel}
                            </span>
                          </>
                        ) : null}
                      </p>
                      {showRoomDetailsAside(
                        selectedDorm.description,
                        selectedDorm.roomDetails
                      ) && selectedDorm.roomDetails ? (
                        <p className="text-xs text-slate-700 border-l-2 border-primary/30 pl-2">
                          {selectedDorm.roomDetails}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Document status:{" "}
                        <Badge variant="outline" className="text-[0.65rem]">
                          {selectedDorm.documentType}
                        </Badge>
                      </p>
                      <p className="whitespace-pre-line text-sm text-slate-700">
                        {selectedDorm.description}
                      </p>
                      <div>
                        <p className="mb-1 text-xs font-semibold text-slate-800">
                          Amenities
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDorm.amenities.map((amenity) => (
                            <Badge
                              key={amenity}
                              variant="muted"
                              className="text-[0.7rem]"
                            >
                              {amenity}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-800">
                      Student Reviews
                    </p>
                    {dialogReviews.length === 0 ? (
                      <p className="text-[0.7rem] text-muted-foreground">
                        No reviews yet for this room.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {dialogReviews.map((review) => (
                          <div
                            key={`${review.author}-${review.date}`}
                            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-[0.7rem] font-semibold text-slate-800">
                                {review.author}
                              </p>
                              <p className="text-[0.65rem] text-muted-foreground">
                                {review.date}
                              </p>
                            </div>
                            <p className="mt-1 text-[0.7rem] text-slate-700">
                              {review.comment}
                            </p>
                            <p className="mt-1 text-[0.65rem] font-semibold text-amber-600">
                              {Array.from({ length: review.rating })
                                .map(() => "★")
                                .join("")}
                              {Array.from({ length: 5 - review.rating })
                                .map(() => "☆")
                                .join("")}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {reservationStep === 2 && (
                <div className="space-y-3 text-sm text-slate-800">
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-semibold">Monthly Rent:</span>{" "}
                      ₱{selectedDorm.price.toLocaleString()}
                    </p>
                    <p>
                      <span className="font-semibold">
                        Advance Payment (1 Month):
                      </span>{" "}
                      ₱{selectedDorm.price.toLocaleString()}
                    </p>
                    <p>
                      <span className="font-semibold">
                        Security Deposit (1 Month):
                      </span>{" "}
                      ₱{selectedDorm.price.toLocaleString()}
                    </p>
                  </div>
                  <hr className="my-2 border-slate-200" />
                  <ul className="space-y-1 text-[0.7rem] text-slate-700">
                    <li>
                      <span className="font-semibold">Advance</span> = Applied
                      to your first month&apos;s rent.
                    </li>
                    <li>
                      <span className="font-semibold">Security deposit</span> =
                      Refundable at end of lease if terms are met.
                    </li>
                    <li>
                      Utilities may be billed separately per dorm policy.
                    </li>
                  </ul>
                </div>
              )}

              {reservationStep === 3 && (
                <div className="space-y-4 text-sm text-slate-700">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label
                        htmlFor="move-in-date"
                        className="text-[0.75rem] font-medium text-slate-800"
                      >
                        Move-in Date
                      </label>
                      <Input
                        id="move-in-date"
                        type="date"
                        className="h-8 text-xs"
                        value={moveInDate}
                        onChange={(e) => setMoveInDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="lease-duration"
                        className="text-[0.75rem] font-medium text-slate-800"
                      >
                        Lease Duration
                      </label>
                      <select
                        id="lease-duration"
                        className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                        value={leaseDuration}
                        onChange={(e) => setLeaseDuration(e.target.value)}
                      >
                        <option value="6">6 months</option>
                        <option value="12">12 months</option>
                        <option value="18">18 months</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[0.7rem] text-muted-foreground">
                    Final terms are subject to landlord confirmation.
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
                    if (reservationStep === 1) {
                      setShowDormDialog(false);
                      setReservationStep(1);
                    } else {
                      setReservationStep(
                        (prev) => (prev - 1) as typeof reservationStep
                      );
                    }
                  }}
                >
                  {reservationStep === 1 ? "Cancel" : "Back"}
                </Button>
                {reservationStep < 3 ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={reservationStep === 1 && !canBook}
                    onClick={() =>
                      setReservationStep(
                        (prev) => (prev + 1) as typeof reservationStep
                      )
                    }
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={!moveInDate || submitting || !canBook}
                    onClick={async () => {
                      if (!selectedDorm || !moveInDate) return;
                      setSubmitError(null);
                      setSubmitting(true);
                      try {
                        const start = new Date(moveInDate);
                        const end = new Date(start);
                        end.setMonth(end.getMonth() + Number(leaseDuration));
                        const res = await fetch("/api/student/reservations", {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            roomId: selectedDorm.id,
                            leaseStart: moveInDate,
                            leaseEnd: end.toISOString().slice(0, 10),
                          }),
                        });
                        const j = (await res.json()) as { error?: string };
                        if (!res.ok) throw new Error(j.error ?? "Failed");
                        setShowDormDialog(false);
                        setReservationStep(1);
                        void loadListings();
                      } catch (e) {
                        setSubmitError(
                          e instanceof Error ? e.message : "Reservation failed"
                        );
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    {submitting ? "Submitting…" : "Confirm Reservation"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {lightboxUrl ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/92 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxUrl(null);
            }}
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[min(90vh,900px)] max-w-full object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
