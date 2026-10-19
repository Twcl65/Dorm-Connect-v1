"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadDormConnectFile } from "@/lib/upload-file-client";
import { ChevronDown, ChevronUp, Loader2, QrCode } from "lucide-react";

type GcashProfile = {
  gcashAccountName: string | null;
  gcashPhone: string | null;
  gcashQrCodeUrl: string | null;
};

type SavedGcashDetails = {
  accountName: string;
  phone: string;
  qrCodeUrl: string | null;
};

function toSavedDetails(
  name: string,
  phone: string,
  qrCodeUrl: string | null
): SavedGcashDetails {
  return {
    accountName: name.trim(),
    phone: phone.trim(),
    qrCodeUrl: qrCodeUrl?.trim() || null,
  };
}

function hasGcashDetails(details: SavedGcashDetails): boolean {
  return Boolean(
    details.accountName || details.phone || details.qrCodeUrl
  );
}

export function LandlordGcashSettingsCard({
  compact = false,
}: {
  compact?: boolean;
}) {
  const qrInputRef = useRef<HTMLInputElement>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [savedDetails, setSavedDetails] = useState<SavedGcashDetails | null>(
    null
  );
  const [accountName, setAccountName] = useState("");
  const [phone, setPhone] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  const applyProfile = useCallback((p: GcashProfile | undefined) => {
    const details = toSavedDetails(
      p?.gcashAccountName ?? "",
      p?.gcashPhone ?? "",
      p?.gcashQrCodeUrl ?? null
    );
    setSavedDetails(hasGcashDetails(details) ? details : null);
    setAccountName(details.accountName);
    setPhone(details.phone);
    setQrCodeUrl(details.qrCodeUrl);
    return details;
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean; keepExpanded?: boolean }) => {
      if (!opts?.silent) setInitialLoading(true);
      if (!opts?.silent) setMessage(null);
      try {
        const res = await fetch("/api/account/profile", {
          credentials: "include",
        });
        const j = (await res.json()) as {
          profile?: GcashProfile;
          error?: string;
        };
        if (!res.ok) throw new Error(j.error ?? "Failed to load");
        const details = applyProfile(j.profile);
        if (!opts?.keepExpanded) {
          setExpanded(!hasGcashDetails(details));
        }
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Failed to load GCash settings"
        );
      } finally {
        if (!opts?.silent) setInitialLoading(false);
      }
    },
    [applyProfile]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const nextDetails = toSavedDetails(accountName, phone, qrCodeUrl);
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gcashAccountName: nextDetails.accountName || null,
          gcashPhone: nextDetails.phone || null,
          gcashQrCodeUrl: nextDetails.qrCodeUrl ?? "",
        }),
      });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setSavedDetails(
        hasGcashDetails(nextDetails) ? nextDetails : null
      );
      setAccountName(nextDetails.accountName);
      setPhone(nextDetails.phone);
      setQrCodeUrl(nextDetails.qrCodeUrl);
      setExpanded(false);
      setMessage("GCash details saved. Students will see these when paying.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onQrUpload = async (file: File | null) => {
    if (!file) return;
    setSaving(true);
    setMessage(null);
    try {
      const url = await uploadDormConnectFile(file);
      setQrCodeUrl(url);
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gcashQrCodeUrl: url }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Upload failed");
      setMessage("QR code uploaded.");
      await load({ silent: true, keepExpanded: true });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  const showSummary = Boolean(savedDetails && !expanded);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader
        className={
          compact
            ? "pb-3 border-b bg-muted/40"
            : "border-b border-slate-100 bg-slate-50/80"
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 shrink-0 text-slate-600" />
            <div>
              <CardTitle className={compact ? "text-sm" : "text-base"}>
                GCash payment details
              </CardTitle>
              <CardDescription className="text-xs">
                Students see this when they choose GCash to pay for reservations
                or rent.
              </CardDescription>
            </div>
          </div>
          {!initialLoading && savedDetails ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1 text-xs"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Hide" : "View"}
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      {initialLoading ? (
        <CardContent className="pt-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading…
          </p>
        </CardContent>
      ) : showSummary && savedDetails ? (
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                Account name
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {savedDetails.accountName || "Not set"}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                Mobile number
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {savedDetails.phone || "Not set"}
              </p>
            </div>
          </div>
          {savedDetails.qrCodeUrl ? (
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={savedDetails.qrCodeUrl}
                  alt="GCash QR code"
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="text-[0.7rem] text-muted-foreground">
                QR code uploaded — students can scan this when paying.
              </p>
            </div>
          ) : (
            <p className="text-[0.7rem] text-muted-foreground">
              No QR code uploaded yet.
            </p>
          )}
          {message ? (
            <p
              className={`text-xs ${
                message.toLowerCase().includes("fail") ||
                message.toLowerCase().includes("error")
                  ? "text-destructive"
                  : "text-emerald-700"
              }`}
            >
              {message}
            </p>
          ) : null}
        </CardContent>
      ) : (
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gcash-name">GCash account name</Label>
              <Input
                id="gcash-name"
                className="h-8 text-xs"
                placeholder="e.g. Juan Dela Cruz"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gcash-phone">GCash mobile number</Label>
              <Input
                id="gcash-phone"
                className="h-8 text-xs"
                placeholder="e.g. 0917 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>GCash QR code image</Label>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-slate-50">
                {qrCodeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrCodeUrl}
                    alt="GCash QR code"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="px-2 text-center text-[0.65rem] text-muted-foreground">
                    No QR uploaded
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={qrInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    void onQrUpload(f ?? null);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={saving}
                  onClick={() => qrInputRef.current?.click()}
                >
                  {qrCodeUrl ? "Replace QR code" : "Upload QR code"}
                </Button>
                {qrCodeUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-red-700"
                    disabled={saving}
                    onClick={() => {
                      void (async () => {
                        setSaving(true);
                        setMessage(null);
                        try {
                          const res = await fetch("/api/account/profile", {
                            method: "PATCH",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ gcashQrCodeUrl: null }),
                          });
                          const j = (await res.json()) as { error?: string };
                          if (!res.ok) throw new Error(j.error ?? "Remove failed");
                          setQrCodeUrl(null);
                          setSavedDetails((prev) =>
                            prev
                              ? { ...prev, qrCodeUrl: null }
                              : toSavedDetails(accountName, phone, null)
                          );
                          setMessage("QR code removed.");
                        } catch (e) {
                          setMessage(
                            e instanceof Error ? e.message : "Remove failed"
                          );
                        } finally {
                          setSaving(false);
                        }
                      })();
                    }}
                  >
                    Remove QR code
                  </Button>
                ) : null}
                <p className="max-w-xs text-[0.65rem] text-muted-foreground">
                  Upload the QR from your GCash app so students can scan and pay.
                </p>
              </div>
            </div>
          </div>

          {message ? (
            <p
              className={`text-xs ${
                message.toLowerCase().includes("fail") ||
                message.toLowerCase().includes("error")
                  ? "text-destructive"
                  : "text-emerald-700"
              }`}
            >
              {message}
            </p>
          ) : null}

          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Saving…
              </>
            ) : (
              "Save GCash details"
            )}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
