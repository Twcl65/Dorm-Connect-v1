"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

type Certification = { label: string; url: string };

type Profile = {
  landlord: {
    id: string;
    name: string;
    gcashAccountName: string | null;
    gcashPhone: string | null;
    gcashQrCodeUrl: string | null;
  };
  property: {
    id: string;
    name: string;
    address: string;
    contactPhone: string | null;
    description: string | null;
  };
  accreditation: {
    status: string;
    dormName: string;
    submittedAt: string | null;
    expiresAt: string | null;
  };
  certifications: Certification[];
  reviewSummary: { avg: number | null; count: number };
  reviews: {
    author: string;
    date: string;
    title: string | null;
    comment: string;
    rating: number;
    roomNo: string;
    propertyName: string;
  }[];
};

function DialogCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      onClick={onClick}
      aria-label="Close"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

export function LandlordProfileDialog({
  propertyId,
  onClose,
}: {
  propertyId: string;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCerts, setShowCerts] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/student/landlord-profile?propertyId=${encodeURIComponent(propertyId)}`,
        { credentials: "include" }
      );
      const json = (await res.json()) as Profile & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load profile");
      setProfile(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <Card className="my-auto w-full max-w-2xl border border-gray-300 bg-white text-slate-900">
        <CardHeader className="flex flex-row items-start justify-between gap-2 border-b bg-white pb-2">
          <div>
            <CardTitle className="text-base text-slate-900">
              Landlord profile
            </CardTitle>
            <p className="text-xs text-slate-500">
              Accreditation, GCash details, and reviews.
            </p>
          </div>
          <DialogCloseButton onClick={onClose} />
        </CardHeader>
        <CardContent className="max-h-[min(78vh,720px)] space-y-4 overflow-y-auto pt-3 text-slate-800">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          ) : null}
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : profile ? (
            <>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-900">
                  {profile.landlord.name}
                </p>
                <p className="text-xs text-slate-500">
                  {profile.property.name} · {profile.property.address}
                </p>
                {profile.property.contactPhone ? (
                  <p className="text-xs text-slate-700">
                    Contact: {profile.property.contactPhone}
                  </p>
                ) : null}
                {profile.property.description ? (
                  <p className="whitespace-pre-line text-xs text-slate-700">
                    {profile.property.description}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge
                    variant="outline"
                    className={
                      profile.accreditation.status === "Approved"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "bg-slate-50"
                    }
                  >
                    Accreditation: {profile.accreditation.status}
                  </Badge>
                  {profile.accreditation.expiresAt ? (
                    <span className="text-xs text-slate-500">
                      Expires {profile.accreditation.expiresAt}
                    </span>
                  ) : null}
                  {profile.certifications.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setShowCerts(true)}
                    >
                      View Certifications
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
                <p className="font-semibold text-slate-900">GCash</p>
                <p className="mt-1">
                  Account name:{" "}
                  <span className="font-medium">
                    {profile.landlord.gcashAccountName || "Not uploaded"}
                  </span>
                </p>
                <p>
                  Number:{" "}
                  <span className="font-medium">
                    {profile.landlord.gcashPhone || "Not uploaded"}
                  </span>
                </p>
                {profile.landlord.gcashQrCodeUrl ? (
                  <button
                    type="button"
                    className="mt-2 block h-36 w-36 overflow-hidden rounded-md border bg-white"
                    onClick={() =>
                      setLightboxUrl(profile.landlord.gcashQrCodeUrl)
                    }
                  >
                    <img
                      src={profile.landlord.gcashQrCodeUrl}
                      alt="GCash QR"
                      className="h-full w-full object-contain"
                    />
                  </button>
                ) : (
                  <p className="mt-1 text-slate-500">QR code not uploaded.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Reviews</p>
                <p className="text-xs text-slate-500">
                  {profile.reviewSummary.count > 0 &&
                  profile.reviewSummary.avg != null
                    ? `★ ${profile.reviewSummary.avg.toFixed(1)} · ${profile.reviewSummary.count} reviews`
                    : "No reviews yet."}
                </p>
                {profile.reviews.map((r, i) => (
                  <div
                    key={`${r.author}-${r.date}-${i}`}
                    className="rounded-md border border-slate-100 bg-white px-3 py-2 text-xs"
                  >
                    <p className="font-medium text-slate-900">
                      {r.author} · Room {r.roomNo}
                    </p>
                    <p className="text-amber-700">★ {r.rating}</p>
                    {r.title ? (
                      <p className="font-medium text-slate-800">{r.title}</p>
                    ) : null}
                    <p className="whitespace-pre-line text-slate-700">
                      {r.comment}
                    </p>
                    <p className="text-slate-500">{r.date}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {showCerts && profile ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10">
          <Card className="w-full max-w-lg border border-gray-300 bg-white">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-white pb-2">
              <CardTitle className="text-base text-slate-900">
                Certifications
              </CardTitle>
              <DialogCloseButton onClick={() => setShowCerts(false)} />
            </CardHeader>
            <CardContent className="space-y-3 pt-3">
              {profile.certifications.map((c) => (
                <div key={c.url} className="space-y-1">
                  <p className="text-xs font-medium text-slate-800">{c.label}</p>
                  <button
                    type="button"
                    className="block overflow-hidden rounded-md border"
                    onClick={() => setLightboxUrl(c.url)}
                  >
                    <img
                      src={c.url}
                      alt={c.label}
                      className="max-h-48 w-full bg-slate-50 object-contain"
                    />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {lightboxUrl ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
