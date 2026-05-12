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
import { Edit3, Eye, Loader2 } from "lucide-react";

const DORMS_PER_PAGE = 5;

type DormRow = {
  propertyId: string;
  dormName: string;
  ownerName: string;
  status: string;
  students: number;
  compliance: "Compliant" | "Warning" | "Non-Compliant";
  totalRooms: number;
  occupiedRooms: number;
};

type DormStatus = "Operating" | "Not Operating" | "Under Inspection";

function StatusBadge({ status }: { status: string }) {
  const colorClasses =
    status === "Operating"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Under Inspection"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-800";

  return (
    <Badge
      className={`${colorClasses} rounded-full px-3 py-1 text-xs font-medium`}
      variant="outline"
    >
      {status}
    </Badge>
  );
}

function ComplianceBadge({
  compliance,
}: {
  compliance: "Compliant" | "Warning" | "Non-Compliant";
}) {
  const colorClasses =
    compliance === "Compliant"
      ? "bg-emerald-100 text-emerald-800"
      : compliance === "Warning"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";

  return (
    <Badge
      className={`${colorClasses} rounded-full px-3 py-1 text-xs font-medium`}
      variant="outline"
    >
      {compliance}
    </Badge>
  );
}

export default function OsaMonitoringPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dorms, setDorms] = useState<DormRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    operating: 0,
    notOperating: 0,
    underInspection: 0,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DormStatus | "all">("all");
  const [complianceFilter, setComplianceFilter] = useState<
    "Compliant" | "Warning" | "Non-Compliant" | "all"
  >("all");
  const [page, setPage] = useState(1);

  const [selectedDorm, setSelectedDorm] = useState<DormRow | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editStatus, setEditStatus] = useState<DormStatus>("Operating");
  const [editCompliance, setEditCompliance] = useState<
    "Compliant" | "Warning" | "Non-Compliant"
  >("Compliant");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/osa/monitoring", { credentials: "include" });
      const json = (await res.json()) as {
        error?: string;
        summary?: typeof summary;
        dorms?: DormRow[];
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setSummary(
        json.summary ?? {
          total: 0,
          operating: 0,
          notOperating: 0,
          underInspection: 0,
        }
      );
      setDorms(json.dorms ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setDorms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, complianceFilter]);

  const monitoringSummary = [
    {
      label: "Accredited dorms",
      key: "total",
      value: summary.total,
      badge: "Registered",
      badgeVariant: "secondary" as const,
    },
    {
      label: "Operating",
      key: "operating",
      value: summary.operating,
      badge: "Operating",
      badgeVariant: "success" as const,
    },
    {
      label: "Not operating",
      key: "notOperating",
      value: summary.notOperating,
      badge: "Closed",
      badgeVariant: "muted" as const,
    },
    {
      label: "Under inspection",
      key: "underInspection",
      value: summary.underInspection,
      badge: "Inspection",
      badgeVariant: "warning" as const,
    },
  ];

  const filteredDorms = useMemo(
    () =>
      dorms.filter((dorm) => {
        const matchesSearch =
          search.trim().length === 0 ||
          dorm.dormName.toLowerCase().includes(search.toLowerCase());
        const matchesStatus =
          statusFilter === "all" || dorm.status === statusFilter;
        const matchesCompliance =
          complianceFilter === "all" || dorm.compliance === complianceFilter;
        return matchesSearch && matchesStatus && matchesCompliance;
      }),
    [dorms, search, statusFilter, complianceFilter]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredDorms.length / DORMS_PER_PAGE) || 1
  );

  const paginatedDorms = useMemo(() => {
    const start = (page - 1) * DORMS_PER_PAGE;
    return filteredDorms.slice(start, start + DORMS_PER_PAGE);
  }, [filteredDorms, page]);

  const from =
    filteredDorms.length === 0 ? 0 : (page - 1) * DORMS_PER_PAGE + 1;
  const to =
    filteredDorms.length === 0
      ? 0
      : Math.min(page * DORMS_PER_PAGE, filteredDorms.length);

  const saveEdit = async () => {
    if (!selectedDorm) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/osa/properties/${selectedDorm.propertyId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationalStatus: editStatus,
            complianceStatus: editCompliance,
          }),
        }
      );
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
            Dorm monitoring
          </h1>
          <p className="text-sm text-muted-foreground">
            Accredited dormitories: occupancy and operational status (from live
            data).
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
        {monitoringSummary.map((card) => (
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
                Dorm list
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Tenant counts reflect confirmed student reservations in the
                system.
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
                value={statusFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setStatusFilter(
                    e.target.value === "all"
                      ? "all"
                      : (e.target.value as DormStatus)
                  )
                }
              >
                <option value="all">All statuses</option>
                <option value="Operating">Operating</option>
                <option value="Under Inspection">Under inspection</option>
                <option value="Not Operating">Not operating</option>
              </select>
              <select
                className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs sm:w-40"
                value={complianceFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setComplianceFilter(
                    e.target.value === "all"
                      ? "all"
                      : (e.target.value as "Compliant" | "Warning" | "Non-Compliant")
                  )
                }
              >
                <option value="all">All compliance</option>
                <option value="Compliant">Compliant</option>
                <option value="Warning">Warning</option>
                <option value="Non-Compliant">Non-compliant</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {loading && dorms.length === 0 ? (
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
                    <TableHead>Status</TableHead>
                    <TableHead>Tenants</TableHead>
                    <TableHead>Rooms (occ./total)</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead className="text-right pr-4 font-semibold text-slate-600">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDorms.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        No accredited dormitories match your filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {paginatedDorms.map((dorm) => (
                    <TableRow key={dorm.propertyId}>
                      <TableCell className="text-sm font-medium text-slate-800">
                        {dorm.dormName}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {dorm.ownerName}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={dorm.status} />
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {dorm.students}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {dorm.occupiedRooms} / {dorm.totalRooms}
                      </TableCell>
                      <TableCell>
                        <ComplianceBadge compliance={dorm.compliance} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 text-[0.7rem] flex items-center gap-1"
                            onClick={() => {
                              setSelectedDorm(dorm);
                              setEditStatus(dorm.status as DormStatus);
                              setEditCompliance(dorm.compliance);
                              setShowEditDialog(true);
                            }}
                          >
                            <Edit3 className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                            onClick={() => {
                              setSelectedDorm(dorm);
                              setShowDetailsDialog(true);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-2 border-t px-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[0.7rem] text-muted-foreground">
                  Showing {from}–{to} of {filteredDorms.length} dorms
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

      {showDetailsDialog && selectedDorm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Dorm details
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs text-slate-800">
              <div className="grid gap-2 md:grid-cols-[140px,1fr] items-center">
                <span className="text-[0.7rem]">Dorm</span>
                <Input
                  value={selectedDorm.dormName}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Landlord</span>
                <Input
                  value={selectedDorm.ownerName}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Operating status</span>
                <Input
                  value={selectedDorm.status}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Compliance</span>
                <Input
                  value={selectedDorm.compliance}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Confirmed tenants</span>
                <Input
                  value={String(selectedDorm.students)}
                  readOnly
                  className="h-8 text-xs"
                />
                <span className="text-[0.7rem]">Rooms occupied / total</span>
                <Input
                  value={`${selectedDorm.occupiedRooms} / ${selectedDorm.totalRooms}`}
                  readOnly
                  className="h-8 text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showEditDialog && selectedDorm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Update dorm status
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowEditDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs text-slate-800">
              <p className="text-muted-foreground">
                {selectedDorm.dormName} — {selectedDorm.ownerName}
              </p>
              <div className="grid gap-2 md:grid-cols-[140px,1fr] items-center">
                <span className="text-[0.7rem]">Operating status</span>
                <select
                  className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as DormStatus)
                  }
                >
                  <option value="Operating">Operating</option>
                  <option value="Under Inspection">Under inspection</option>
                  <option value="Not Operating">Not operating</option>
                </select>
                <span className="text-[0.7rem]">Compliance</span>
                <select
                  className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={editCompliance}
                  onChange={(e) =>
                    setEditCompliance(
                      e.target.value as "Compliant" | "Warning" | "Non-Compliant"
                    )
                  }
                >
                  <option value="Compliant">Compliant</option>
                  <option value="Warning">Warning</option>
                  <option value="Non-Compliant">Non-compliant</option>
                </select>
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
