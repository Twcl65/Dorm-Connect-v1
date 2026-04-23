"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

type OsaItem = { id: string; title: string; message: string; date: string };

type PropertyOpt = { id: string; name: string };

type TenantStudent = {
  studentUserId: string;
  fullName: string;
  roomNo: string;
};

type SentTenantAnn = {
  id: string;
  title: string;
  message: string;
  date: string;
  audience: "all_booked" | "single_student";
  propertyName: string;
  targetStudentName: string | null;
};

export default function LandlordAnnouncementsPage() {
  const [loadingOsa, setLoadingOsa] = useState(true);
  const [osaItems, setOsaItems] = useState<OsaItem[]>([]);
  const [osaError, setOsaError] = useState<string | null>(null);

  const [loadingTenant, setLoadingTenant] = useState(true);
  const [properties, setProperties] = useState<PropertyOpt[]>([]);
  const [sentAnnouncements, setSentAnnouncements] = useState<SentTenantAnn[]>(
    []
  );
  const [tenantError, setTenantError] = useState<string | null>(null);

  const [propertyId, setPropertyId] = useState("");
  const [audience, setAudience] = useState<"all_booked" | "single_student">(
    "all_booked"
  );
  const [targetStudentUserId, setTargetStudentUserId] = useState("");
  const [eligibleStudents, setEligibleStudents] = useState<TenantStudent[]>(
    []
  );
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadOsa = useCallback(async () => {
    setOsaError(null);
    setLoadingOsa(true);
    try {
      const res = await fetch("/api/landlord/announcements", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        error?: string;
        announcements?: OsaItem[];
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setOsaItems(json.announcements ?? []);
    } catch (e) {
      setOsaError(e instanceof Error ? e.message : "Failed to load");
      setOsaItems([]);
    } finally {
      setLoadingOsa(false);
    }
  }, []);

  const loadTenant = useCallback(async () => {
    setTenantError(null);
    setLoadingTenant(true);
    try {
      const res = await fetch("/api/landlord/tenant-announcements", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        error?: string;
        properties?: PropertyOpt[];
        announcements?: SentTenantAnn[];
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setProperties(json.properties ?? []);
      setSentAnnouncements(json.announcements ?? []);
    } catch (e) {
      setTenantError(e instanceof Error ? e.message : "Failed to load");
      setProperties([]);
      setSentAnnouncements([]);
    } finally {
      setLoadingTenant(false);
    }
  }, []);

  useEffect(() => {
    void loadOsa();
  }, [loadOsa]);

  useEffect(() => {
    void loadTenant();
  }, [loadTenant]);

  useEffect(() => {
    if (!showCreateDialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showCreateDialog]);

  useEffect(() => {
    if (!propertyId || audience !== "single_student") {
      setEligibleStudents([]);
      setTargetStudentUserId("");
      return;
    }
    let cancelled = false;
    setLoadingStudents(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/landlord/tenant-announcements/eligible-students?propertyId=${encodeURIComponent(propertyId)}`,
          { credentials: "include" }
        );
        const j = (await res.json()) as {
          students?: TenantStudent[];
          error?: string;
        };
        if (!res.ok) throw new Error(j.error ?? "Failed");
        if (!cancelled) {
          setEligibleStudents(j.students ?? []);
          setTargetStudentUserId("");
        }
      } catch {
        if (!cancelled) {
          setEligibleStudents([]);
          setTargetStudentUserId("");
        }
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, audience]);

  const submitTenantAnnouncement = async () => {
    setTenantError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/landlord/tenant-announcements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          title: title.trim(),
          body: body.trim(),
          audience,
          targetStudentUserId:
            audience === "single_student" ? targetStudentUserId : null,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to post");
      setTitle("");
      setBody("");
      setTargetStudentUserId("");
      await loadTenant();
      setShowCreateDialog(false);
    } catch (e) {
      setTenantError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 text-xs"
            onClick={() => {
              setTenantError(null);
              setShowCreateDialog(true);
            }}
          >
            New announcement
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Office notices for operators, and messages you send to students
          staying at your dorm.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">
          Office of Student Affairs
        </h2>
        {osaError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {osaError}
          </div>
        )}
        {loadingOsa ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : osaItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No OSA announcements.</p>
        ) : (
          <div className="space-y-4">
            {osaItems.map((a) => (
              <Card key={a.id} className="border border-gray-300 bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">{a.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{a.date}</p>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-slate-700 whitespace-pre-wrap">
                  {a.message}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => void loadOsa()}
          disabled={loadingOsa}
        >
          Refresh OSA notices
        </Button>
      </section>

      <section className="space-y-4 border-t border-slate-200 pt-0">
        {tenantError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {tenantError}
          </div>
        )}

        {showCreateDialog && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 pb-8 sm:py-10">
            <Card className="flex max-h-[calc(100vh-5rem)] w-full max-w-lg flex-col border border-gray-300 bg-white">
              <CardHeader className="shrink-0 border-b bg-muted/40 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">
                    New announcement
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-[0.7rem]"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pt-4 text-xs">
                {tenantError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {tenantError}
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1 md:col-span-2">
                    <label className="font-medium text-slate-800">Dorm</label>
                    <select
                      className="h-9 w-full rounded-md border border-gray-300 bg-white px-2"
                      value={propertyId}
                      onChange={(e) => setPropertyId(e.target.value)}
                      disabled={loadingTenant || properties.length === 0}
                    >
                      <option value="">Select property</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="font-medium text-slate-800">Send to</label>
                    <select
                      className="h-9 w-full rounded-md border border-gray-300 bg-white px-2"
                      value={audience}
                      onChange={(e) =>
                        setAudience(
                          e.target.value === "single_student"
                            ? "single_student"
                            : "all_booked"
                        )
                      }
                    >
                      <option value="all_booked">
                        All students with an active booking at this dorm
                      </option>
                      <option value="single_student">One student only</option>
                    </select>
                  </div>
                  {audience === "single_student" && propertyId ? (
                    <div className="space-y-1 md:col-span-2">
                      <label className="font-medium text-slate-800">Student</label>
                      {loadingStudents ? (
                        <p className="text-[0.7rem] text-muted-foreground">
                          Loading students…
                        </p>
                      ) : eligibleStudents.length === 0 ? (
                        <p className="text-[0.7rem] text-amber-800">
                          No active reservations at this dorm. Students must have a
                          pending or confirmed booking.
                        </p>
                      ) : (
                        <select
                          className="h-9 w-full rounded-md border border-gray-300 bg-white px-2"
                          value={targetStudentUserId}
                          onChange={(e) =>
                            setTargetStudentUserId(e.target.value)
                          }
                        >
                          <option value="">Select student</option>
                          {eligibleStudents.map((s) => (
                            <option key={s.studentUserId} value={s.studentUserId}>
                              {s.fullName} — Room {s.roomNo}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : null}
                  <div className="space-y-1 md:col-span-2">
                    <label className="font-medium text-slate-800">Title</label>
                    <Input
                      className="h-9 text-xs"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Rent collection — March"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="font-medium text-slate-800">Message</label>
                    <Textarea
                      className="min-h-[120px] text-xs"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="e.g. Please settle March rent by Friday. I will collect cash at the office on Saturday 9–11am."
                    />
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 text-xs"
                    disabled={
                      saving ||
                      !propertyId ||
                      !title.trim() ||
                      !body.trim() ||
                      (audience === "single_student" && !targetStudentUserId)
                    }
                    onClick={() => void submitTenantAnnouncement()}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Post to students"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Sent to your tenants
          </h3>
          {loadingTenant ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : sentAnnouncements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tenant announcements yet.
            </p>
          ) : (
            <div className="space-y-3">
              {sentAnnouncements.map((a) => (
                <Card
                  key={a.id}
                  className="border border-slate-200 bg-white"
                >
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      {a.title}
                    </CardTitle>
                    <p className="text-[0.65rem] text-muted-foreground">
                      {a.propertyName} · {a.date} ·{" "}
                      {a.audience === "all_booked"
                        ? "All booked students"
                        : `To: ${a.targetStudentName ?? "—"}`}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-slate-700 whitespace-pre-wrap">
                    {a.message}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-8 text-xs"
            onClick={() => void loadTenant()}
            disabled={loadingTenant}
          >
            Refresh list
          </Button>
        </div>
      </section>
    </div>
  );
}
