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
import { Edit3, Loader2 } from "lucide-react";

const STATS_PER_PAGE = 5;

type InspectionResult = "Compliant" | "Warning" | "Non-Compliant";

type InspectionRow = {
  id: string;
  propertyId: string;
  dormName: string;
  inspectionDate: string;
  result: InspectionResult;
  nextAction: string;
};

function ResultBadge({ result }: { result: InspectionResult }) {
  const colorClasses =
    result === "Compliant"
      ? "bg-emerald-100 text-emerald-800"
      : result === "Warning"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";

  return (
    <Badge
      className={`${colorClasses} rounded-full px-3 py-1 text-xs font-medium`}
      variant="outline"
    >
      {result}
    </Badge>
  );
}

export default function OsaSafetyPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [summary, setSummary] = useState({
    compliant: 0,
    warnings: 0,
    nonCompliant: 0,
    inspectionDue: 0,
  });

  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<InspectionResult | "all">(
    "all"
  );
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<InspectionRow | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editResult, setEditResult] = useState<InspectionResult>("Compliant");
  const [editDate, setEditDate] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/osa/safety", { credentials: "include" });
      const json = (await res.json()) as {
        error?: string;
        summary?: typeof summary;
        inspections?: InspectionRow[];
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setSummary(
        json.summary ?? {
          compliant: 0,
          warnings: 0,
          nonCompliant: 0,
          inspectionDue: 0,
        }
      );
      setInspections(json.inspections ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setInspections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, resultFilter]);

  const safetySummary = [
    {
      label: "Compliant dorms",
      key: "compliant",
      value: summary.compliant,
      badge: "Compliant",
      badgeVariant: "success" as const,
    },
    {
      label: "Warnings",
      key: "warnings",
      value: summary.warnings,
      badge: "Warnings",
      badgeVariant: "warning" as const,
    },
    {
      label: "Non-compliant",
      key: "nonCompliant",
      value: summary.nonCompliant,
      badge: "Non-compliant",
      badgeVariant: "destructive" as const,
    },
    {
      label: "Follow-up queue",
      key: "inspectionDue",
      value: summary.inspectionDue,
      badge: "Review",
      badgeVariant: "secondary" as const,
    },
  ];

  const filtered = useMemo(
    () =>
      inspections.filter((insp) => {
        const matchesSearch =
          search.trim().length === 0 ||
          insp.dormName.toLowerCase().includes(search.toLowerCase());
        const matchesResult =
          resultFilter === "all" || insp.result === resultFilter;
        return matchesSearch && matchesResult;
      }),
    [inspections, search, resultFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / STATS_PER_PAGE));
  const paginated = useMemo(() => {
    const start = (page - 1) * STATS_PER_PAGE;
    return filtered.slice(start, start + STATS_PER_PAGE);
  }, [filtered, page]);

  const from = filtered.length === 0 ? 0 : (page - 1) * STATS_PER_PAGE + 1;
  const to =
    filtered.length === 0
      ? 0
      : Math.min(page * STATS_PER_PAGE, filtered.length);

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/osa/properties/${selected.propertyId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complianceStatus: editResult,
          lastInspectionAt: editDate || null,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to save");
      setShowEditDialog(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Safety & compliance
          </h1>
          <p className="text-sm text-muted-foreground">
            Compliance flags and last inspection dates per accredited dorm.
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
        {safetySummary.map((card) => (
          <Card
            key={card.key}
            className="border border-gray-300 bg-white shadow-sm"
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between pt-0">
              <p className="text-2xl font-semibold tracking-tight">
                {loading ? "—" : card.value}
              </p>
              <Badge
                variant={card.badgeVariant as never}
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
                Dorm compliance records
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Update compliance after inspections or document reviews.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Search dorm..."
                className="h-8 w-full bg-muted text-xs sm:w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs sm:w-40"
                value={resultFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setResultFilter(
                    e.target.value === "all"
                      ? "all"
                      : (e.target.value as InspectionResult)
                  )
                }
              >
                <option value="all">All results</option>
                <option value="Compliant">Compliant</option>
                <option value="Warning">Warning</option>
                <option value="Non-Compliant">Non-compliant</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {loading && inspections.length === 0 ? (
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
                    <TableHead>Last inspection</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right pr-4 font-semibold text-slate-600">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        No accredited dormitories to show.
                      </TableCell>
                    </TableRow>
                  )}
                  {paginated.map((insp) => (
                    <TableRow key={insp.propertyId}>
                      <TableCell className="text-sm font-medium text-slate-800">
                        {insp.dormName}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {insp.inspectionDate}
                      </TableCell>
                      <TableCell>
                        <ResultBadge result={insp.result} />
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 max-w-[220px]">
                        {insp.nextAction}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[0.7rem] flex items-center gap-1"
                            onClick={() => {
                              setSelected(insp);
                              setEditResult(insp.result);
                              setEditDate(
                                insp.inspectionDate === "—"
                                  ? ""
                                  : insp.inspectionDate
                              );
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit3 className="h-3 w-3" />
                            Update
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-2 border-t px-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[0.7rem] text-muted-foreground">
                  Showing {from}–{to} of {filtered.length} dorms
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

      {showEditDialog && selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-lg border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <CardTitle className="text-base font-semibold text-slate-900">
                Update compliance record
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs text-slate-800">
              <p className="font-medium">{selected.dormName}</p>
              <div className="grid gap-2 md:grid-cols-[130px,1fr] items-center">
                <span className="text-[0.7rem]">Compliance level</span>
                <select
                  className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={editResult}
                  onChange={(e) =>
                    setEditResult(e.target.value as InspectionResult)
                  }
                >
                  <option value="Compliant">Compliant</option>
                  <option value="Warning">Warning</option>
                  <option value="Non-Compliant">Non-compliant</option>
                </select>
                <span className="text-[0.7rem]">Last inspection date</span>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={saving}
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={saving}
                  onClick={() => void saveEdit()}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
