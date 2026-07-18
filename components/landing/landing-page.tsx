"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Building2,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  LogIn,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";
import { spreadOverlappingMarkers } from "@/lib/spread-map-markers";
import type { PublicAccreditedProperty } from "@/lib/public-properties";
import type { StudentMapMarker } from "@/components/maps/student-properties-map";

const StudentDormMap = dynamic(
  () =>
    import("@/components/maps/student-properties-map").then((m) => ({
      default: m.StudentDormMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(520px,55vh)] min-h-[420px] w-full items-center justify-center rounded-2xl border bg-slate-50 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading map…
      </div>
    ),
  }
);

const FALLBACK_COVER =
  "https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=1200";

const HERO_BG =
  "https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1600";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "OSA-accredited only",
    description: "Every property listed has passed Office of Student Affairs approval.",
  },
  {
    icon: BedDouble,
    title: "Live availability",
    description: "Room status and rates are updated directly by landlords.",
  },
  {
    icon: ClipboardCheck,
    title: "Guided reservations",
    description: "Students register, get ICT-verified, then book in a few steps.",
  },
  {
    icon: MapPin,
    title: "Campus proximity",
    description: "Browse dormitories and boarding houses near USTP on an interactive map.",
  },
] as const;

const STEPS = [
  { step: "01", title: "Browse listings", body: "Explore accredited properties and compare room rates." },
  { step: "02", title: "Create your account", body: "Register with your USTP email and complete your profile." },
  { step: "03", title: "Get verified", body: "ICT confirms your student status before booking opens." },
  { step: "04", title: "Reserve a room", body: "Submit a reservation and track it from your dashboard." },
] as const;

const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#dormitories", label: "Dormitories" },
  { href: "#map", label: "Map" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#about", label: "About" },
] as const;

function formatPrice(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}

function priceRangeLabel(min: number | null, max: number | null): string {
  if (min == null) return "Rates on request";
  if (max == null || min === max) return `${formatPrice(min)}/mo`;
  return `${formatPrice(min)} – ${formatPrice(max)}/mo`;
}

function PropertyCard({
  property,
  highlighted,
}: {
  property: PublicAccreditedProperty;
  highlighted: boolean;
}) {
  const cover =
    property.coverImageUrl?.trim() ||
    property.rooms[0]?.images[0] ||
    FALLBACK_COVER;
  const availableRooms = property.rooms.filter((r) => r.status === "Available");

  return (
    <article
      id={`property-${property.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60",
        highlighted && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover}
          alt={property.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            <ShieldCheck className="h-3 w-3" />
            Accredited
          </span>
          {property.availableRoomCount > 0 ? (
            <span className="rounded-full bg-primary/90 px-2.5 py-1 text-[0.65rem] font-semibold text-white backdrop-blur-sm">
              {property.availableRoomCount} open
            </span>
          ) : (
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[0.65rem] font-semibold text-white backdrop-blur-sm">
              Fully booked
            </span>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-white/70">
            {property.propertyType}
          </p>
          <h3 className="mt-0.5 text-lg font-semibold leading-snug text-white">
            {property.name}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="line-clamp-2">
              {[property.address, property.city].filter(Boolean).join(", ")}
            </span>
          </div>
          <p className="shrink-0 text-right text-sm font-bold text-primary">
            {priceRangeLabel(property.minPrice, property.maxPrice)}
          </p>
        </div>

        <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-600">
          {property.description}
        </p>

        {property.listedRoomCount === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-muted-foreground">
            Listings coming soon — landlord has not published rooms yet.
          </p>
        ) : (
          <div className="mt-4">
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
              Room availability
            </p>
            <div className="flex flex-wrap gap-1.5">
              {property.rooms.slice(0, 4).map((room) => (
                <span
                  key={room.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[0.7rem]",
                    room.status === "Available"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  )}
                >
                  <span className="font-medium">Rm {room.roomNo}</span>
                  <span className="text-slate-400">·</span>
                  <span>{formatPrice(room.price)}</span>
                </span>
              ))}
              {property.rooms.length > 4 && (
                <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-[0.7rem] text-muted-foreground">
                  +{property.rooms.length - 4} more
                </span>
              )}
            </div>
            {availableRooms.length > 0 && (
              <p className="mt-2 text-xs text-emerald-700">
                {availableRooms.length} room{availableRooms.length !== 1 ? "s" : ""} ready to book
              </p>
            )}
          </div>
        )}

        <Button
          asChild
          className="mt-5 w-full gap-2 rounded-xl shadow-sm group-hover:shadow-md"
        >
          <Link href="/login?next=/student/browse">
            Reserve a room
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

function ListingSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="aspect-[4/3] animate-pulse bg-slate-200" />
          <div className="space-y-3 p-5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-10 animate-pulse rounded-xl bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LandingPage() {
  const [properties, setProperties] = useState<PublicAccreditedProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightPropertyId, setHighlightPropertyId] = useState<string | null>(
    null
  );

  const loadProperties = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/public/properties", { cache: "no-store" });
      const json = (await res.json()) as {
        properties?: PublicAccreditedProperty[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load properties");
      setProperties(json.properties ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load properties");
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  const stats = useMemo(() => {
    const withListings = properties.filter((p) => p.listedRoomCount > 0);
    const availableRooms = properties.reduce(
      (sum, p) => sum + p.availableRoomCount,
      0
    );
    return {
      accreditedCount: properties.length,
      withListingsCount: withListings.length,
      availableRooms,
    };
  }, [properties]);

  const mapMarkers = useMemo((): StudentMapMarker[] => {
    const raw: StudentMapMarker[] = [];
    for (const p of properties) {
      if (p.latitude == null || p.longitude == null) continue;
      if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) continue;
      raw.push({
        id: p.id,
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
        coverImageUrl: p.coverImageUrl,
      });
    }
    return spreadOverlappingMarkers(raw);
  }, [properties]);

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-slate-900">
      {/* ── Navigation ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-0.5 shadow-lg">
              <img src="/icon.png" alt="DormConnect Logo" className="h-full w-full object-contain rounded-lg" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-white">DormConnect</p>
              <p className="text-[0.6rem] font-medium uppercase tracking-widest text-slate-400">
                USTP
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 lg:flex xl:gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden text-slate-300 hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              <Link href="/register">Register</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-full bg-primary px-5 shadow-lg shadow-primary/25 hover:bg-primary/90"
            >
              <Link href="/login">
                <LogIn className="mr-1.5 h-4 w-4" />
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section id="home" className="relative scroll-mt-16 overflow-hidden bg-slate-950 pt-16">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${HERO_BG})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950/95 to-slate-900" />
          <div className="absolute -right-32 top-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 text-secondary" />
                  Official USTP dormitory & boarding house portal
                </div>

                <div className="space-y-4">
                  <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                    Your trusted path to{" "}
                    <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                      accredited housing
                    </span>
                  </h1>
                  <p className="max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
                    Discover OSA-approved dormitories and boarding houses near campus.
                    Compare room rates, check real-time availability, and reserve your
                    space — all in one place.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-full px-8 shadow-xl shadow-primary/30"
                  >
                    <a href="#dormitories">
                      Browse dormitories
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-full border-white/20 bg-white/5 px-8 text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link href="/register">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Get started
                    </Link>
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
                  {[
                    { value: stats.accreditedCount, label: "Accredited" },
                    { value: stats.availableRooms, label: "Rooms open" },
                    { value: stats.withListingsCount, label: "With listings" },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <p className="text-2xl font-bold tabular-nums text-white sm:text-3xl">
                        {loading ? "—" : stat.value}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative hidden lg:block">
                <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/20 to-secondary/10 blur-2xl" />
                <Card className="relative overflow-hidden border-white/10 bg-white/5 shadow-2xl backdrop-blur-md">
                  <CardContent className="p-0">
                    <div className="relative aspect-[4/3]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={FALLBACK_COVER}
                        alt="Sample accredited dormitory"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <Badge variant="success" className="mb-3">
                          <BadgeCheck className="mr-1 h-3 w-3" />
                          OSA Verified
                        </Badge>
                        <p className="text-lg font-semibold text-white">
                          Accredited properties only
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Every listing meets USTP safety and compliance standards.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10">
                      <div className="p-4 text-center">
                        <p className="text-xs text-slate-500">Property types</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          Dorm · Boarding
                        </p>
                      </div>
                      <div className="p-4 text-center">
                        <p className="text-xs text-slate-500">Booking</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          Online & secure
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        </section>

        {/* ── Features ── */}
        <section className="border-b border-slate-200/80 bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="group flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Listings ── */}
        <section id="dormitories" className="scroll-mt-20 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Available properties
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  Accredited boarding houses & dormitories
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  {loading
                    ? "Loading the latest listings…"
                    : `${properties.length} accredited propert${properties.length === 1 ? "y" : "ies"} listed.`}
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="mt-8">
              {loading ? (
                <ListingSkeleton />
              ) : properties.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                    <Building2 className="h-7 w-7 text-slate-400" />
                  </div>
                  <p className="mt-5 text-base font-semibold text-slate-800">
                    No accredited properties yet
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Check back when landlords publish new listings.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {properties.map((property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      highlighted={highlightPropertyId === property.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Map ── */}
        {mapMarkers.length > 0 && (
          <section
            id="map"
            className="scroll-mt-20 border-y border-slate-200/80 bg-white py-16 sm:py-20"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="grid items-start gap-10 lg:grid-cols-[0.4fr,0.6fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Location
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                    Find housing near campus
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Tap a pin to jump to that property in the listings above. All mapped
                    locations belong to accredited properties with published availability.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {mapMarkers.slice(0, 5).map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setHighlightPropertyId(m.id);
                            document
                              .getElementById(`property-${m.id}`)
                              ?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                          className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm transition-colors hover:border-primary/30 hover:bg-primary/5"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-slate-800">{m.name}</span>
                          <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
                        </button>
                      </li>
                    ))}
                    {mapMarkers.length > 5 && (
                      <p className="pl-1 text-xs text-muted-foreground">
                        +{mapMarkers.length - 5} more on the map
                      </p>
                    )}
                  </ul>
                </div>
                <div className="h-[min(520px,55vh)] min-h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">
                  <StudentDormMap
                    markers={mapMarkers}
                    onMarkerClick={(propertyId) => {
                      setHighlightPropertyId(propertyId);
                      document
                        .getElementById(`property-${propertyId}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── How it works ── */}
        <section id="how-it-works" className="scroll-mt-20 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                For students
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                How to reserve your room
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                From browsing to move-in — four simple steps through DormConnect.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item, index) => (
                <div
                  key={item.step}
                  className="relative rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
                >
                  {index < STEPS.length - 1 && (
                    <div className="absolute right-0 top-1/2 hidden h-px w-6 translate-x-full bg-slate-200 lg:block" />
                  )}
                  <p className="text-3xl font-bold text-primary">{item.step}</p>
                  <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── About ── */}
        <section id="about" className="scroll-mt-20 border-t border-slate-200/80 bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  About DormConnect
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  Accredited dormitory management for USTP
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  DormConnect is the official web platform for managing accredited dormitories
                  and boarding houses for University of Science and Technology of Southern
                  Philippines students, landlords, and administrators.
                </p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  The Office of Student Affairs oversees accreditation and compliance. Landlords
                  publish room availability and rates; students browse listings, complete ICT
                  verification, and reserve rooms online — all in one centralized system.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    title: "Students",
                    body: "Browse accredited housing, reserve rooms, pay rent, and report incidents.",
                  },
                  {
                    title: "Landlords",
                    body: "Manage properties, list rooms, handle reservations, and track compliance.",
                  },
                  {
                    title: "OSA / SAS",
                    body: "Review accreditation, schedule inspections, and monitor dormitory safety.",
                  },
                  {
                    title: "ICT Admin",
                    body: "Verify student accounts and manage platform users and access.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5"
                  >
                    <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-amber-500" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-60" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-15">
            <h2 className="text-2xl font-bold text-white sm:text-4xl">
              Ready to find your home away from home?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-white/85 sm:text-base">
              Join USTP students who use DormConnect to discover accredited housing and
              manage reservations online.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-white px-8 text-primary shadow-xl hover:bg-white/90"
              >
                <Link href="/register">Create free account</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/40 bg-transparent px-8 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-slate-950 text-slate-400">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-0.5">
                  <img src="/icon.png" alt="DormConnect Logo" className="h-full w-full object-contain rounded-lg" />
                </div>
                <p className="text-base font-bold text-white">DormConnect</p>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-relaxed">
                Web-based accredited dormitory and boarding house management system
                for University of Science and Technology of Southern Philippines.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Explore
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="hover:text-white">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Account
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link href="/login" className="hover:text-white">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-white">
                    Student registration
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-8 text-xs sm:flex-row">
            <p>© {new Date().getFullYear()} DormConnect · USTP</p>
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              OSA-accredited properties only
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
