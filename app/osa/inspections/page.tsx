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
import { Input } from "@/components/ui/input";
import { ClipboardCheck, Loader2 } from "lucide-react";
import {
  LANDLORD_SAFETY_DECLARATION,
  OSA_INSPECTION_CHECKLIST,
  type OsaChecklistKey,
  displayInspectionResult,
  mergeChecklist,
} from "@/lib/osa-inspection";
import { cn } from "@/components/ui/utils";

type ScheduleRow = {
  inspectionId: string | null;
  accreditationRequestId: string;
  dormName: string;
  address: string;
  ownerName: string;
  ownerEmail: string;
  applicationStatus: string;
  scheduledFor: string | null;
  scheduleStatus: "upcoming" | "completed" | "overdue";
  result: string | null;
  notes: string;
  completedAt: string | null;
  checklist: Record<OsaChecklistKey, boolean>;
  landlordDeclaration: Record<string, boolean>;
  canRecordResult: boolean;
};

type Summary = {
  recommended: number;
  rejected: number;
  onHold: number;
  upcoming: number;
};

function ResultBadge({ result }: { result: string | null }) {
  if (!result) {
    return (
      <Badge variant="outline" className="rounded-full text-[0.65rem]">
        Pending
      </Badge>
    );
  }
  const colorClasses =
    result === "Recommended for Approval"
      ? "bg-emerald-100 text-emerald-800"
      : result === "Rejected"
        ? "bg-red-100 text-red-800"
        : result === "Hold"
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-800";

  return (
    <Badge
      className={`${colorClasses} rounded-full px-3 py-1 text-xs font-medium`}
      variant="outline"
    >
      {displayInspectionResult(result)}
    </Badge>
  );
}

function ScheduleStatusBadge({
  status,
}: {
  status: ScheduleRow["scheduleStatus"];
}) {
  const colorClasses =
    status === "completed"
      ? "bg-slate-100 text-slate-700"
      : status === "overdue"
        ? "bg-red-100 text-red-800"
        : "bg-sky-100 text-sky-800";

  return (
    <Badge
      className={`${colorClasses} rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium`}
      variant="outline"
    >
      {status === "completed"
        ? "Completed"
        : status === "overdue"
          ? "Overdue"
          : "Scheduled"}
    </Badge>
  );
}

const ROWS_PER_PAGE = 8;

export default function OsaInspectionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    recommended: 0,
    rejected: 0,
    onHold: 0,
    upcoming: 0,
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "upcoming" | "completed" | "recommended" | "rejected" | "hold"
  >("all");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<ScheduleRow | null>(null);
  const [showConductDialog, setShowConductDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [inspectionResult, setInspectionResult] = useState(
    "Recommended for Approval"
  );
  const [holdReason, setHoldReason] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [checklist, setChecklist] = useState(mergeChecklist(null));
  const [scheduleDate, setScheduleDate] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/osa/inspections", { credentials: "include" });
      const json = (await res.json()) as {
        error?: string;
        summary?: Summary;
        schedules?: ScheduleRow[];
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setSummary(
        json.summary ?? { recommended: 0, rejected: 0, onHold: 0, upcoming: 0 }
      );
      setSchedules(json.schedules ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  const filtered = useMemo(() => {
    return schedules.filter((row) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        row.dormName.toLowerCase().includes(q) ||
        row.ownerName.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ||
        (filter === "upcoming" &&
          (row.scheduleStatus === "upcoming" ||
            row.scheduleStatus === "overdue")) ||
        (filter === "completed" && row.scheduleStatus === "completed") ||
        (filter === "recommended" &&
          row.result === "Recommended for Approval") ||
        (filter === "rejected" && row.result === "Rejected") ||
        (filter === "hold" && row.result === "Hold");
      return matchesSearch && matchesFilter;
    });
  }, [schedules, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return filtered.slice(start, start + ROWS_PER_PAGE);
  }, [filtered, page]);

  const from = filtered.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1;
  const to = Math.min(page * ROWS_PER_PAGE, filtered.length);

  const openConduct = (row: ScheduleRow) => {
    setSelected(row);
    setInspectionResult("Recommended for Approval");
    setHoldReason("");
    setInspectionNotes(row.notes ?? "");
    setChecklist(mergeChecklist(row.checklist));
    setShowConductDialog(true);
  };

  const openSchedule = (row: ScheduleRow) => {
    setSelected(row);
    setScheduleDate(row.scheduledFor ?? "");
    setShowScheduleDialog(true);
  };

  const saveSchedule = async () => {
    if (!selected || !scheduleDate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/osa/accreditation/${selected.accreditationRequestId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Scheduled for Inspection",
            inspectionScheduledFor: scheduleDate,
          }),
        }
      );
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to schedule");
      setShowScheduleDialog(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule");
    } finally {
      setSaving(false);
    }
  };

  const submitInspection = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/osa/inspections", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accreditationRequestId: selected.accreditationRequestId,
          result: inspectionResult,
          checklist,
          notes: inspectionNotes.trim(),
          holdReason: inspectionResult === "Hold" ? holdReason.trim() : undefined,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to save");
      setShowConductDialog(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const checklistByCategory = useMemo(() => {
    type ChecklistItem = (typeof OSA_INSPECTION_CHECKLIST)[number];
    const groups = new Map<string, ChecklistItem[]>();
    for (const item of OSA_INSPECTION_CHECKLIST) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return [...groups.entries()];
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inspections</h1>
          <p className="text-sm text-muted-foreground">
            Schedule on-site inspections, verify landlord checklists, and record
            accreditation results.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Recommended for Approval",
            value: summary.recommended,
            badge: "Approved path",
            className: "bg-emerald-100 text-emerald-800",
          },
          {
            label: "Rejected",
            value: summary.rejected,
            badge: "Rejected",
            className: "bg-red-100 text-red-800",
          },
          {
            label: "On Hold",
            value: summary.onHold,
            badge: "On Hold",
            className: "bg-amber-100 text-amber-800",
          },
          {
            label: "Upcoming / due",
            value: summary.upcoming,
            badge: "Scheduled",
            className: "bg-sky-100 text-sky-800",
          },
        ].map((card) => (
          <Card
            key={card.label}
            className="border border-gray-300 bg-white shadow-sm"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between pt-0">
              <p className="text-2xl font-semibold tracking-tight">
                {loading ? "—" : card.value}
              </p>
              <Badge className={cn("text-[0.65rem]", card.className)} variant="outline">
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
                Inspection schedules
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Upcoming and completed inspections linked to accreditation
                applications.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Search dorm or landlord…"
                className="h-8 w-full bg-muted text-xs sm:w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs sm:w-44"
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value as typeof filter)
                }
              >
                <option value="all">All</option>
                <option value="upcoming">Upcoming / overdue</option>
                <option value="completed">Completed</option>
                <option value="recommended">Recommended</option>
                <option value="rejected">Rejected</option>
                <option value="hold">On Hold</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {loading && schedules.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <Table bordered={false}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dorm</TableHead>
                    <TableHead>Landlord</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        No inspections match your filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {paginated.map((row) => (
                    <TableRow key={row.accreditationRequestId}>
                      <TableCell className="text-sm font-medium text-slate-800">
                        {row.dormName}
                        <p className="text-[0.65rem] font-normal text-muted-foreground">
                          {row.address || "—"}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {row.ownerName}
                        <p className="text-[0.65rem] text-muted-foreground">
                          {row.ownerEmail}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {row.scheduledFor ?? "—"}
                      </TableCell>
                      <TableCell>
                        <ScheduleStatusBadge status={row.scheduleStatus} />
                      </TableCell>
                      <TableCell>
                        <ResultBadge result={row.result} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1.5">
                          {!row.scheduledFor && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[0.65rem]"
                              onClick={() => openSchedule(row)}
                            >
                              Schedule
                            </Button>
                          )}
                          {row.canRecordResult && (
                            <Button
                              size="sm"
                              className="h-7 px-2 text-[0.65rem] flex items-center gap-1"
                              onClick={() => openConduct(row)}
                            >
                              <ClipboardCheck className="h-3 w-3" />
                              Inspect
                            </Button>
                          )}
                          {row.scheduleStatus === "completed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[0.65rem]"
                              onClick={() => openConduct(row)}
                            >
                              View
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-2 border-t px-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[0.7rem] text-muted-foreground">
                  Showing {from}–{to} of {filtered.length} inspections
                </p>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[0.7rem]"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-[0.7rem]">
                    Page {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[0.7rem]"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {showScheduleDialog && selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <CardTitle className="text-base font-semibold text-slate-900">
                Schedule inspection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <p>
                Set the on-site date for{" "}
                <span className="font-semibold">{selected.dormName}</span>. The
                landlord will be notified.
              </p>
              <Input
                type="date"
                className="h-9 text-xs"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={saving}
                  onClick={() => setShowScheduleDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={!scheduleDate || saving}
                  onClick={() => void saveSchedule()}
                >
                  {saving ? "Saving…" : "Save schedule"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showConductDialog && selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-2xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <CardTitle className="text-base font-semibold text-slate-900">
                Inspection checklist — {selected.dormName}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {selected.ownerName} · Scheduled{" "}
                {selected.scheduledFor ?? "not set"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-xs text-slate-800 max-h-[min(80vh,720px)] overflow-y-auto">
              <section className="space-y-2">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Landlord declaration (from application)
                </p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {LANDLORD_SAFETY_DECLARATION.map((item) => (
                    <li
                      key={item.key}
                      className={cn(
                        "flex items-start gap-2 rounded-md border px-2 py-1.5",
                        selected.landlordDeclaration[item.key]
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-slate-50"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full",
                          selected.landlordDeclaration[item.key]
                            ? "bg-emerald-500"
                            : "bg-slate-300"
                        )}
                      />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-3">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  OSA on-site verification
                </p>
                {checklistByCategory.map(([category, items]) => (
                  <div key={category} className="space-y-1.5">
                    <p className="text-[0.7rem] font-medium text-muted-foreground">
                      {category}
                    </p>
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <label
                          key={item.key}
                          className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 px-2 py-1.5 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checklist[item.key]}
                            disabled={
                              selected.scheduleStatus === "completed" &&
                              selected.result != null
                            }
                            onChange={(e) =>
                              setChecklist((prev) => ({
                                ...prev,
                                [item.key]: e.target.checked,
                              }))
                            }
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>

              <section className="space-y-2 border-t pt-3">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Inspection result
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    {
                      value: "Recommended for Approval",
                      label: "Recommended for Approval",
                      active: "border-emerald-500 bg-emerald-50",
                    },
                    {
                      value: "Rejected",
                      label: "Rejected",
                      active: "border-red-500 bg-red-50",
                    },
                    { value: "Hold", label: "On Hold", active: "border-amber-500 bg-amber-50" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={
                        selected.scheduleStatus === "completed" &&
                        selected.result != null
                      }
                      className={cn(
                        "rounded-lg border px-2 py-2 text-[0.7rem] font-medium transition-colors",
                        inspectionResult === opt.value
                          ? opt.active
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                      onClick={() => setInspectionResult(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {inspectionResult === "Hold" && (
                  <div className="space-y-1">
                    <label className="text-[0.7rem] font-medium text-slate-700">
                      On hold reason <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      className="w-full min-h-[64px] rounded-md border border-slate-300 px-2 py-1 text-xs"
                      value={holdReason}
                      disabled={
                        selected.scheduleStatus === "completed" &&
                        selected.result != null
                      }
                      onChange={(e) => setHoldReason(e.target.value)}
                      placeholder="Specify what the landlord must correct or submit…"
                    />
                  </div>
                )}

                {inspectionResult === "Rejected" && (
                  <div className="space-y-1">
                    <label className="text-[0.7rem] font-medium text-slate-700">
                      Rejection reason <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      className="w-full min-h-[64px] rounded-md border border-slate-300 px-2 py-1 text-xs"
                      value={inspectionNotes}
                      disabled={
                        selected.scheduleStatus === "completed" &&
                        selected.result != null
                      }
                      onChange={(e) => setInspectionNotes(e.target.value)}
                      placeholder="Why the application was rejected…"
                    />
                  </div>
                )}

                {inspectionResult !== "Rejected" && (
                  <div className="space-y-1">
                    <label className="text-[0.7rem] font-medium text-slate-700">
                      {inspectionResult === "Hold"
                        ? "Additional notes"
                        : "Inspection notes (optional)"}
                    </label>
                    <textarea
                      className="w-full min-h-[56px] rounded-md border border-slate-300 px-2 py-1 text-xs"
                      value={inspectionNotes}
                      disabled={
                        selected.scheduleStatus === "completed" &&
                        selected.result != null
                      }
                      onChange={(e) => setInspectionNotes(e.target.value)}
                      placeholder="Optional inspection notes…"
                    />
                  </div>
                )}
              </section>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={saving}
                  onClick={() => setShowConductDialog(false)}
                >
                  Close
                </Button>
                {!(
                  selected.scheduleStatus === "completed" && selected.result
                ) && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={saving}
                    onClick={() => void submitInspection()}
                  >
                    {saving ? "Saving…" : "Submit result"}
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
