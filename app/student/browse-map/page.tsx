"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { uploadDormConnectFile } from "@/lib/upload-file-client";
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
      <div className="flex h-[min(55vh,520px)] w-full items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading map…
      </div>
    ),
  }
);

type MapRoom = {
  id: string;
  roomNo: string;
  capacity: number;
  price: number;
  status: string;
  description: string;
  images: string[];
};

type MapProperty = {
  id: string;
  name: string;
  propertyType: string;
  address: string;
  contactPhone: string;
  description: string;
  landlordName: string;
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
  propertyImages: string[];
  rooms: MapRoom[];
};

export default function StudentBrowseMapPage() {
  const [properties, setProperties] = useState<MapProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ictVerificationStatus, setIctVerificationStatus] = useState<
    string | null
  >(null);

  const [propertyDialog, setPropertyDialog] = useState<MapProperty | null>(
    null
  );
  const [bookRoom, setBookRoom] = useState<MapRoom | null>(null);
  const [bookProperty, setBookProperty] = useState<MapProperty | null>(null);

  const [guestName, setGuestName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [course, setCourse] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [leaseMonths, setLeaseMonths] = useState("12");
  const [reservationFee, setReservationFee] = useState("0");
  const [studentIdFile, setStudentIdFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/map-properties", {
        credentials: "include",
      });
      const data = (await res.json()) as {
        properties?: MapProperty[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setProperties(data.properties ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const json = (await res.json()) as {
          user?: { name?: string; ictVerificationStatus?: string | null };
        };
        if (cancelled) return;
        setIctVerificationStatus(json.user?.ictVerificationStatus ?? null);
        if (json.user?.name) setGuestName(json.user.name);
      } catch {
        if (!cancelled) setIctVerificationStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canBook = ictVerificationStatus === "Verified";

  const markers: StudentMapMarker[] = useMemo(
    () =>
      spreadOverlappingMarkers(
        properties.map((p) => ({
          id: p.id,
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
          coverImageUrl: p.coverImageUrl,
        }))
      ),
    [properties]
  );

  const openBook = (prop: MapProperty, room: MapRoom) => {
    setBookProperty(prop);
    setBookRoom(room);
    setSubmitError(null);
    setStudentIdFile(null);
    setReservationFee("0");
  };

  const confirmReservation = async () => {
    if (!bookRoom || !bookProperty || !moveInDate) return;
    if (!canBook) {
      setSubmitError("ICT must verify your account before you can reserve.");
      return;
    }
    if (
      !guestName.trim() ||
      !contactPhone.trim() ||
      !emergencyName.trim() ||
      !emergencyPhone.trim() ||
      !course.trim()
    ) {
      setSubmitError("Please complete all required fields.");
      return;
    }
    if (!studentIdFile) {
      setSubmitError("Student ID upload is required.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const proofUrl = await uploadDormConnectFile(studentIdFile);
      const start = new Date(moveInDate);
      const end = new Date(start);
      end.setMonth(end.getMonth() + Number(leaseMonths || 12));
      const fee = Math.max(0, Number(reservationFee) || 0);
      const res = await fetch("/api/student/reservations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: bookRoom.id,
          leaseStart: moveInDate,
          leaseEnd: end.toISOString().slice(0, 10),
          guestName: guestName.trim(),
          contactPhone: contactPhone.trim(),
          emergencyContactName: emergencyName.trim(),
          emergencyContactPhone: emergencyPhone.trim(),
          course: course.trim(),
          studentIdProofUrl: proofUrl,
          reservationFee: fee,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Reservation failed");
      setBookRoom(null);
      setBookProperty(null);
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Reservation failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Browse on map
        </h1>
        <p className="text-sm text-muted-foreground">
          Green markers show accredited properties with available rooms. Tap a
          marker for details, then book a room.
        </p>
      </div>

      {ictVerificationStatus && ictVerificationStatus !== "Verified" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {ictVerificationStatus === "Pending Verification"
            ? "Your account is pending ICT verification. You can explore the map, but booking is enabled only after verification."
            : "Your registration was not approved. You cannot reserve from the map."}
        </div>
      )}

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {loadError}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Accredited dormitories & boarding houses
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : markers.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No mapped accredited properties yet. Landlords must add coordinates
              under Properties and list available rooms.
            </p>
          ) : (
            <div className="h-[min(55vh,560px)] w-full overflow-hidden rounded-lg border">
              <StudentDormMap
                markers={markers}
                onMarkerClick={(id) => {
                  const p = properties.find((x) => x.id === id);
                  if (p) setPropertyDialog(p);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {propertyDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-3 py-8">
          <Card className="my-auto w-full max-w-2xl max-h-[90vh] overflow-y-auto border bg-white">
            <CardHeader className="flex flex-row items-start justify-between gap-2 border-b">
              <div>
                <CardTitle className="text-lg">{propertyDialog.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {propertyDialog.propertyType} · {propertyDialog.address}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setPropertyDialog(null)}
              >
                Close
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-sm">
              <div className="flex flex-wrap gap-2">
                {(propertyDialog.propertyImages.length
                  ? propertyDialog.propertyImages
                  : propertyDialog.coverImageUrl
                    ? [propertyDialog.coverImageUrl]
                    : []
                ).map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className="h-24 w-32 rounded-md border object-cover"
                  />
                ))}
              </div>
              <p>
                <span className="font-medium">Contact:</span>{" "}
                {propertyDialog.contactPhone}
              </p>
              <p>
                <span className="font-medium">Landlord:</span>{" "}
                {propertyDialog.landlordName}
              </p>
              <p className="text-slate-700 whitespace-pre-wrap">
                {propertyDialog.description}
              </p>
              <div>
                <h3 className="text-sm font-semibold mb-2">Available rooms</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {propertyDialog.rooms.map((r) => (
                    <Card key={r.id} className="border">
                      <CardContent className="p-3 space-y-2">
                        <div className="h-24 w-full overflow-hidden rounded bg-slate-100">
                          {r.images[0] ? (
                            <img
                              src={r.images[0]}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <p className="font-medium">Room {r.roomNo}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {r.description}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline">Cap {r.capacity}</Badge>
                          <Badge variant="outline">₱{r.price}/mo</Badge>
                          <Badge variant="secondary">{r.status}</Badge>
                        </div>
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          disabled={!canBook}
                          onClick={() => openBook(propertyDialog, r)}
                        >
                          Book room
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {bookRoom && bookProperty && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 px-3 py-8">
          <Card className="my-auto w-full max-w-md border bg-white">
            <CardHeader className="border-b">
              <CardTitle className="text-base">Confirm reservation</CardTitle>
              <p className="text-xs text-muted-foreground">
                {bookProperty.name} — Room {bookRoom.roomNo}
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs">
              {submitError && (
                <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-red-800">
                  {submitError}
                </div>
              )}
              <div className="rounded bg-muted/50 p-2 space-y-1">
                <p>
                  <span className="font-medium">Monthly rent:</span> ₱
                  {bookRoom.price.toLocaleString()}
                </p>
                <p>
                  <span className="font-medium">Capacity:</span> {bookRoom.capacity}
                </p>
              </div>
              <div className="space-y-1">
                <Label>Student name</Label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label>Contact number</Label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label>Emergency contact name</Label>
                <Input
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label>Emergency contact phone</Label>
                <Input
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label>Course</Label>
                <Input
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Move-in date</Label>
                  <Input
                    type="date"
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Lease (months)</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-white px-2 text-xs"
                    value={leaseMonths}
                    onChange={(e) => setLeaseMonths(e.target.value)}
                  >
                    <option value="6">6</option>
                    <option value="12">12</option>
                    <option value="18">18</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Reservation fee (optional, ₱)</Label>
                <Input
                  type="number"
                  min={0}
                  value={reservationFee}
                  onChange={(e) => setReservationFee(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label>Student ID (image upload)</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  className="text-xs"
                  onChange={(e) =>
                    setStudentIdFile(e.target.files?.[0] ?? null)
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setBookRoom(null);
                    setBookProperty(null);
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={submitting || !canBook}
                  onClick={() => void confirmReservation()}
                >
                  {submitting ? "Submitting…" : "Confirm reservation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
