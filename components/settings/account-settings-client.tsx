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
import { Loader2, Shield, UserRound, Building2, FileText } from "lucide-react";

type LatestAccreditation = {
  id: string;
  dormName: string;
  address: string;
  status: string;
  submittedAt: string;
  documentsCount: number;
  formData: unknown;
};

type ProfilePayload = {
  fullName: string;
  email: string;
  role: string;
  studentId: string | null;
  profileImageUrl: string | null;
  latestAccreditation: LatestAccreditation | null;
};

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="text-sm text-slate-900 whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}

function AccreditationReadonly({ acc }: { acc: LatestAccreditation }) {
  const fd =
    acc.formData && typeof acc.formData === "object"
      ? (acc.formData as Record<string, unknown>)
      : {};
  const dorm =
    fd.dorm && typeof fd.dorm === "object"
      ? (fd.dorm as Record<string, unknown>)
      : {};
  const owner =
    fd.owner && typeof fd.owner === "object"
      ? (fd.owner as Record<string, unknown>)
      : {};
  const safety =
    fd.safety && typeof fd.safety === "object"
      ? (fd.safety as Record<string, unknown>)
      : {};
  const declaration =
    fd.declaration && typeof fd.declaration === "object"
      ? (fd.declaration as Record<string, unknown>)
      : {};
  const docNames: string[] = Array.isArray(fd.documentFileNames)
    ? (fd.documentFileNames as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const attachments: string[] = Array.isArray(fd.attachmentUrls)
    ? (fd.attachmentUrls as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const str = (v: unknown) => (typeof v === "string" ? v : v != null ? String(v) : "");
  const boolYes = (v: unknown) => (v === true ? "Yes" : v === false ? "No" : "—");

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/80">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-600" />
          <div>
            <CardTitle className="text-base">Accreditation on file</CardTitle>
            <CardDescription>
              Submitted information for OSA review (read-only). Official dorm
              name and address are taken from your latest request.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8 pt-6 text-slate-800">
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Building2 className="h-4 w-4" />
            Request summary
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" value={acc.status} />
            <Field label="Submitted" value={acc.submittedAt} />
            <Field label="Dorm name (record)" value={acc.dormName} />
            <Field label="Address (record)" value={acc.address} />
            <Field
              label="Documents counted"
              value={String(acc.documentsCount)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
          <p className="text-sm font-semibold text-slate-900">Dorm information</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dorm name" value={str(dorm.name)} />
            <Field label="Street address" value={str(dorm.address)} />
            <Field label="City / locality" value={str(dorm.city)} />
            <Field label="Dorm contact" value={str(dorm.contact)} />
            <Field label="Dorm email" value={str(dorm.email)} />
            <Field label="Type" value={str(dorm.type)} />
            <Field label="Rooms (declared)" value={str(dorm.rooms)} />
            <Field label="Capacity (declared)" value={str(dorm.capacity)} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
          <p className="text-sm font-semibold text-slate-900">Landlord information</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Owner name" value={str(owner.name)} />
            <Field label="Business name" value={str(owner.businessName)} />
            <Field label="Owner contact" value={str(owner.contact)} />
            <Field label="Owner email" value={str(owner.email)} />
          </div>
          {(typeof owner.ownerIdFrontUrl === "string" ||
            typeof owner.ownerIdBackUrl === "string") && (
            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              {typeof owner.ownerIdFrontUrl === "string" && (
                <div className="space-y-1">
                  <p className="text-[0.65rem] font-semibold uppercase text-slate-500">
                    ID (front)
                  </p>
                  <a
                    href={owner.ownerIdFrontUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline"
                  >
                    View file
                  </a>
                </div>
              )}
              {typeof owner.ownerIdBackUrl === "string" && (
                <div className="space-y-1">
                  <p className="text-[0.65rem] font-semibold uppercase text-slate-500">
                    ID (back)
                  </p>
                  <a
                    href={owner.ownerIdBackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline"
                  >
                    View file
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {(docNames.length > 0 || attachments.length > 0) && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-900">Documents</p>
            {docNames.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                {docNames.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {attachments.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-primary underline"
                  >
                    Attachment {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            Safety &amp; compliance (declaration)
          </p>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <Field label="Marked exits" value={boolYes(safety.exits)} />
            <Field
              label="Fire extinguishers"
              value={boolYes(safety.extinguishers)}
            />
            <Field label="Emergency contacts posted" value={boolYes(safety.contacts)} />
            <Field label="Room safety checklist" value={boolYes(safety.rooms)} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-900">Signatory</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={str(declaration.name)} />
            <Field label="Date" value={str(declaration.date)} />
            <Field label="Signature (as entered)" value={str(declaration.signature)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountSettingsClient() {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);

  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/profile", { credentials: "include" });
      const j = (await res.json()) as {
        profile?: ProfilePayload;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Failed to load");
      const p = j.profile;
      if (!p) throw new Error("Invalid response");
      setProfile(p);
      setFullName(p.fullName);
      setStudentId(p.studentId ?? "");
      setProfileImageUrl(p.profileImageUrl);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async () => {
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      const body: Record<string, unknown> = {
        fullName: fullName.trim(),
        profileImageUrl: profileImageUrl ?? "",
      };
      if (profile?.role === "Student") {
        body.studentId = studentId.trim() || null;
      }
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setProfileMsg("Profile saved.");
      await load();
      if (typeof window !== "undefined") window.dispatchEvent(new Event("dc-profile-updated"));
    } catch (e) {
      setProfileMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg("New password and confirmation do not match.");
      return;
    }
    setSavingPw(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed");
      setPwMsg("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setPwMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setSavingPw(false);
    }
  };

  const onPickAvatar = async (file: File | null) => {
    if (!file) return;
    setProfileMsg(null);
    setSavingProfile(true);
    try {
      const url = await uploadDormConnectFile(file);
      setProfileImageUrl(url);
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileImageUrl: url }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Upload failed");
      setProfileMsg("Photo updated.");
      await load();
      if (typeof window !== "undefined") window.dispatchEvent(new Event("dc-profile-updated"));
    } catch (e) {
      setProfileMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-12">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading account settings…
      </div>
    );
  }
  if (loadError || !profile) {
    return (
      <p className="text-sm text-destructive py-8">
        {loadError ?? "Could not load profile."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Account &amp; settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Manage your profile, security, and — for dorm owners — the accreditation
          details on file with OSA.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-slate-600" />
            <div>
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription>
                Your name appears on reservations, receipts, and internal records.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex flex-col items-start gap-3">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-inner">
                {profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-500">
                    No photo
                  </div>
                )}
              </div>
              <div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  aria-label="Upload profile photo"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    void onPickAvatar(f ?? null);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  Change photo
                </Button>
                <p className="mt-2 text-[0.7rem] text-muted-foreground max-w-xs">
                  JPG, PNG, WebP, or GIF. Max 6 MB. Used in the header and on printed views where applicable.
                </p>
              </div>
            </div>
            <div className="flex-1 space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="fullName">Display name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile.email} disabled className="bg-muted" />
                <p className="text-[0.7rem] text-muted-foreground">
                  Email is managed by ICT. Contact an administrator if it must be changed.
                </p>
              </div>
              {profile.role === "Student" && (
                <div className="space-y-2">
                  <Label htmlFor="studentId">School ID</Label>
                  <Input
                    id="studentId"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. 2024-12345"
                  />
                </div>
              )}
              {profileMsg && (
                <p
                  className={`text-sm ${
                    profileMsg.includes("fail") || profileMsg.includes("Invalid")
                      ? "text-destructive"
                      : "text-emerald-700"
                  }`}
                >
                  {profileMsg}
                </p>
              )}
              <Button
                type="button"
                onClick={() => void saveProfile()}
                disabled={savingProfile || !fullName.trim()}
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-600" />
            <div>
              <CardTitle className="text-base">Security</CardTitle>
              <CardDescription>
                Use a strong password you do not reuse on other websites.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="curPw">Current password</Label>
            <Input
              id="curPw"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPw">New password</Label>
            <Input
              id="newPw"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confPw">Confirm new password</Label>
            <Input
              id="confPw"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {pwMsg && (
            <p
              className={`text-sm ${
                pwMsg.toLowerCase().includes("fail") ||
                pwMsg.toLowerCase().includes("incorrect") ||
                pwMsg.includes("match")
                  ? "text-destructive"
                  : "text-emerald-700"
              }`}
            >
              {pwMsg}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void savePassword()}
            disabled={
              savingPw ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
          >
            {savingPw ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </CardContent>
      </Card>

      {profile.role === "Landlord" && profile.latestAccreditation && (
        <AccreditationReadonly acc={profile.latestAccreditation} />
      )}

      {profile.role === "Landlord" && !profile.latestAccreditation && (
        <Card className="border-dashed border-slate-200 bg-slate-50/50">
          <CardHeader>
            <CardTitle className="text-base">Accreditation</CardTitle>
            <CardDescription>
              No accreditation request found yet. Submit your documents under{" "}
              <span className="font-medium text-slate-800">Accreditation Documents</span>{" "}
              to register your dorm with OSA.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
