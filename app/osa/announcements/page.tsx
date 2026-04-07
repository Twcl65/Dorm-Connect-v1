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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PenSquare, Eye, Loader2 } from "lucide-react";

const PAGE_SIZE = 5;

type AnnRow = {
  id: string;
  date: string;
  title: string;
  audience: string;
  status: "Posted" | "Not Yet Posted";
  isActive: boolean;
  body: string;
};

function StatusBadge({ status }: { status: AnnRow["status"] }) {
  const colorClasses =
    status === "Posted"
      ? "bg-emerald-100 text-emerald-800"
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

export default function OsaAnnouncementsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<AnnRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    current: 0,
    scheduled: 0,
    expired: 0,
  });

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selected, setSelected] = useState<AnnRow | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formAudience, setFormAudience] = useState("Students");
  const [formBody, setFormBody] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/osa/announcements", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        error?: string;
        announcements?: AnnRow[];
        summary?: typeof summary;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setList(json.announcements ?? []);
      setSummary(
        json.summary ?? {
          total: 0,
          current: 0,
          scheduled: 0,
          expired: 0,
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = useMemo(
    () =>
      list.filter((ann) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          ann.title.toLowerCase().includes(q) ||
          ann.audience.toLowerCase().includes(q)
        );
      }),
    [list, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const from = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to =
    filtered.length === 0 ? 0 : Math.min(page * PAGE_SIZE, filtered.length);

  const summaryCards = [
    {
      label: "Total announcements",
      key: "total",
      value: summary.total,
      badge: "All",
      badgeVariant: "secondary" as const,
    },
    {
      label: "Posted / active",
      key: "current",
      value: summary.current,
      badge: "Live",
      badgeVariant: "success" as const,
    },
    {
      label: "Draft / inactive",
      key: "scheduled",
      value: summary.scheduled,
      badge: "Hidden",
      badgeVariant: "warning" as const,
    },
    {
      label: "Expired (manual)",
      key: "expired",
      value: summary.expired,
      badge: "N/A",
      badgeVariant: "muted" as const,
    },
  ];

  const publishNew = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/osa/announcements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          body: formBody,
          audience: formAudience,
          isActive: formActive,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to publish");
      setShowCreateDialog(false);
      setFormTitle("");
      setFormBody("");
      setFormAudience("Students");
      setFormActive(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Announcements
          </h1>
          <p className="text-sm text-muted-foreground">
            Publish notices to students, landlords, or everyone in DormConnect.
          </p>
        </div>
        <Button
          size="sm"
          className="mt-2 h-8 bg-emerald-500 px-3 text-xs font-medium text-white hover:bg-emerald-600 flex items-center gap-1"
          onClick={() => {
            setFormTitle("");
            setFormBody("");
            setFormAudience("Students");
            setFormActive(true);
            setShowCreateDialog(true);
          }}
        >
          <PenSquare className="h-3 w-3" />
          Create announcement
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
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
              <Badge variant={card.badgeVariant} className="text-[0.7rem]">
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
                All announcements
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Students see Students + All; landlords see Landlords + All.
              </p>
            </div>
            <Input
              placeholder="Search title or audience..."
              className="h-8 w-full bg-muted text-xs sm:w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {loading && list.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <Table bordered={false}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Status</TableHead>
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
                        No announcements yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {paginated.map((ann) => (
                    <TableRow key={ann.id}>
                      <TableCell className="text-xs text-slate-600">
                        {ann.date}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-800">
                        {ann.title}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {ann.audience}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={ann.status} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                            onClick={() => {
                              setSelected(ann);
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
                  Showing {from}–{to} of {filtered.length}
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

      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-2xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Create announcement
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs text-slate-800">
              <div className="grid gap-2 md:grid-cols-[80px,1fr] items-center">
                <Label className="text-[0.7rem]">Title</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="h-8 text-xs"
                />
                <Label className="text-[0.7rem]">Audience</Label>
                <select
                  className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={formAudience}
                  onChange={(e) => setFormAudience(e.target.value)}
                >
                  <option value="Students">Students</option>
                  <option value="Landlords">Landlords</option>
                  <option value="All">Students and landlords</option>
                </select>
                <Label className="text-[0.7rem]">Visible</Label>
                <label className="flex items-center gap-2 text-[0.7rem]">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                  />
                  Active (shown to the selected audience)
                </label>
              </div>
              <div className="space-y-1">
                <Label className="text-[0.7rem]">Message</Label>
                <Textarea
                  className="min-h-[120px] text-xs"
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={saving}
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs bg-emerald-500 text-white hover:bg-emerald-600"
                  disabled={
                    saving || !formTitle.trim() || !formBody.trim()
                  }
                  onClick={() => void publishNew()}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showDetailsDialog && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Announcement
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
              <p className="font-semibold text-sm">{selected.title}</p>
              <p className="text-muted-foreground">
                {selected.date} · {selected.audience} ·{" "}
                <StatusBadge status={selected.status} />
              </p>
              <Textarea readOnly className="min-h-[160px] text-xs" value={selected.body} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
