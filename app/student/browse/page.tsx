"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

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
  images: string[];
  reviewSummary: { avg: number | null; count: number };
};

export default function StudentBrowseDormsPage() {
  const [listings, setListings] = useState<Dorm[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [draftMaxPrice, setDraftMaxPrice] = useState("6000");
  const [selectedDorm, setSelectedDorm] = useState<Dorm | null>(null);
  const [showDormDialog, setShowDormDialog] = useState(false);
  const [reservationStep, setReservationStep] = useState<1 | 2 | 3>(1);
  const [moveInDate, setMoveInDate] = useState("");
  const [leaseDuration, setLeaseDuration] = useState("12");
  const [dialogReviews, setDialogReviews] = useState<DormReview[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadListings = useCallback(async () => {
    setListError(null);
    setListLoading(true);
    try {
      const res = await fetch("/api/student/listings", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        listings?: Dorm[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setListings(json.listings ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load");
      setListings([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

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

  const filteredDorms = useMemo(
    () =>
      listings.filter((dorm) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          q.length === 0 ||
          dorm.name.toLowerCase().includes(q) ||
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

        return matchesSearch && matchesLocation && matchesDoc && matchesPrice;
      }),
    [listings, search, locationFilter, docTypeFilter, maxPrice]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Browse Dormitories
          </h1>
          <p className="text-sm text-muted-foreground">
            Explore listed rooms from accredited and pending properties.
          </p>
        </div>
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listLoading && filteredDorms.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full">
            Loading listings…
          </p>
        ) : null}
        {!listLoading && filteredDorms.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-full">
            No listed rooms match your filters. Landlords must post listings from
            their Rooms page.
          </p>
        ) : null}
        {filteredDorms.map((dorm) => (
          <Card key={dorm.id} className="flex flex-col overflow-hidden">
            <div className="h-28 w-full overflow-hidden bg-slate-200">
              <img
                src={dorm.images[0]}
                alt={dorm.name}
                className="h-full w-full object-cover"
              />
            </div>
            <CardHeader className="space-y-1">
              <CardTitle className="text-sm">{dorm.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{dorm.location}</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-3">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-primary">
                  ₱{dorm.price.toLocaleString()} / month
                </p>
                {dorm.reviewSummary.count > 0 && dorm.reviewSummary.avg != null && (
                  <p className="text-[0.7rem] text-amber-700">
                    ★ {dorm.reviewSummary.avg.toFixed(1)} (
                    {dorm.reviewSummary.count} reviews)
                  </p>
                )}
                <p className="text-[0.7rem] text-muted-foreground">
                  Document type:{" "}
                  <span className="font-medium text-slate-800">
                    {dorm.documentType}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dorm.amenities.map((amenity) => (
                    <Badge key={amenity} variant="muted" className="text-[0.7rem]">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                className="w-full mt-2"
                size="sm"
                onClick={() => {
                  setSelectedDorm(dorm);
                  setReservationStep(1);
                  setMoveInDate("");
                  setLeaseDuration("12");
                  setSubmitError(null);
                  setShowDormDialog(true);
                }}
              >
                Reserve
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      {showPriceDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
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
                      <div className="h-52 w-full overflow-hidden rounded-md bg-slate-200">
                        <img
                          src={selectedDorm.images[0]}
                          alt={selectedDorm.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
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
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Document status:{" "}
                        <Badge variant="outline" className="text-[0.65rem]">
                          {selectedDorm.documentType}
                        </Badge>
                      </p>
                      <p className="text-sm text-slate-700">
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
                    disabled={!moveInDate || submitting}
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
    </div>
  );
}
