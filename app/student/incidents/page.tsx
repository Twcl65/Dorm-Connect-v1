"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, Loader2 } from "lucide-react";
import { uploadDormConnectFiles } from "@/lib/upload-file-client";
import { ProofMedia } from "@/components/proof-media";

type RoomOpt = {
  roomId: string;
  roomNo: string;
  propertyName: string;
};

type Report = {
  id: string;
  title: string;
  description: string;
  status: string;
  imageUrls: string[];
  createdAt: string;
  roomNo: string | null;
  propertyName: string | null;
  landlordName: string | null;
};

export default function StudentIncidentsPage() {
  const [rooms, setRooms] = useState<RoomOpt[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const [roomId, setRoomId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const [rRooms, rRep] = await Promise.all([
        fetch("/api/student/incidents/rooms", { credentials: "include" }),
        fetch("/api/student/incidents", { credentials: "include" }),
      ]);
      const jRooms = (await rRooms.json()) as {
        rooms?: RoomOpt[];
        error?: string;
      };
      const jRep = (await rRep.json()) as {
        reports?: Report[];
        error?: string;
      };
      if (!rRooms.ok) throw new Error(jRooms.error ?? "Failed to load rooms");
      if (!rRep.ok) throw new Error(jRep.error ?? "Failed to load reports");
      setRooms(jRooms.rooms ?? []);
      setReports(jRep.reports ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showReportDialog && !showDetailsDialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showReportDialog, showDetailsDialog]);

  const submit = async () => {
    setReportError(null);
    setSaving(true);
    try {
      let imageUrls: string[] = [];
      if (photoFiles.length > 0) {
        imageUrls = await uploadDormConnectFiles(photoFiles);
      }
      const res = await fetch("/api/student/incidents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          title,
          description,
          imageUrls,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to submit");
      setTitle("");
      setDescription("");
      setPhotoFiles([]);
      setRoomId("");
      setShowReportDialog(false);
      await load();
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Incident reports
          </h1>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 text-xs"
            onClick={() => {
              setReportError(null);
              setShowReportDialog(true);
            }}
          >
            Report incident
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Report a situation to your dorm landlord. Include the room so the
          message reaches the right owner.
        </p>
      </div>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {loadError}
        </div>
      )}

      {showReportDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 pb-8 sm:py-10">
          <Card className="flex max-h-[calc(100vh-5rem)] w-full max-w-lg flex-col border border-gray-300 bg-white">
            <CardHeader className="shrink-0 border-b bg-muted/40 pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-semibold">
                  Report to landlord
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-[0.7rem]"
                  onClick={() => setShowReportDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pt-4 text-xs">
              {reportError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {reportError}
                </div>
              )}
              <div className="space-y-1">
                <label className="font-medium text-slate-800">Room / dorm</label>
                <select
                  className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                >
                  <option value="">Select a room</option>
                  {rooms.map((r) => (
                    <option key={r.roomId} value={r.roomId}>
                      {r.propertyName} — Room {r.roomNo}
                    </option>
                  ))}
                </select>
                <p className="text-[0.65rem] text-muted-foreground">
                  Only rooms tied to your active reservations (pending or
                  confirmed) are listed.
                </p>
                {!loading && rooms.length === 0 ? (
                  <p className="text-[0.65rem] text-amber-800">
                    You do not have an active reservation yet. Book a room from
                    Browse Dormitories to report an incident for that stay.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <label className="font-medium text-slate-800">Title</label>
                <Input
                  className="h-8 text-xs"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Short summary"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium text-slate-800">Description</label>
                <Textarea
                  className="min-h-[100px] text-xs"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened, when, and what you need from the landlord."
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium text-slate-800">
                  Photos (optional)
                </label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  className="h-8 cursor-pointer text-xs"
                  onChange={(e) =>
                    setPhotoFiles(Array.from(e.target.files ?? []).slice(0, 6))
                  }
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setShowReportDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={
                    saving || !roomId || !title.trim() || !description.trim()
                  }
                  onClick={() => void submit()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Submit report"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-2 border-b bg-muted/40">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Your reports</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reports yet.</p>
          ) : (
            <Table bordered={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Landlord</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-4 font-semibold text-slate-600">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-[0.7rem] whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{r.title}</TableCell>
                    <TableCell className="text-[0.7rem]">
                      {r.propertyName ?? "—"} — Rm {r.roomNo ?? "—"}
                    </TableCell>
                    <TableCell className="text-[0.7rem]">{r.landlordName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[0.65rem]">
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                          onClick={() => {
                            setSelectedReport(r);
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
          )}
        </CardContent>
      </Card>

      {showDetailsDialog && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 pb-8 sm:py-10">
          <Card className="flex max-h-[calc(100vh-5rem)] w-full max-w-2xl flex-col border border-gray-300 bg-white">
            <CardHeader className="shrink-0 border-b bg-muted/40 pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    {selectedReport.title}
                  </CardTitle>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    Submitted{" "}
                    {new Date(selectedReport.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-[0.7rem]"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pt-4 text-xs text-slate-800">
              <p className="text-[0.7rem] text-muted-foreground">
                Report ID:{" "}
                <span className="font-mono text-slate-700">
                  {selectedReport.id}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.7rem] text-muted-foreground">Status:</span>
                <Badge variant="outline" className="text-[0.65rem]">
                  {selectedReport.status}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Location
                </p>
                <p className="text-[0.7rem] text-slate-700">
                  {selectedReport.propertyName ?? "—"} — Room{" "}
                  {selectedReport.roomNo ?? "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Landlord
                </p>
                <p className="text-[0.7rem] text-slate-700">
                  {selectedReport.landlordName ?? "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Description
                </p>
                <p className="whitespace-pre-wrap text-[0.7rem] text-slate-700">
                  {selectedReport.description}
                </p>
              </div>
              {selectedReport.imageUrls.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[0.75rem] font-semibold text-slate-900">
                    Photos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedReport.imageUrls.map((url) => (
                      <div
                        key={url}
                        className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-1"
                      >
                        <ProofMedia
                          url={url}
                          className="max-h-40 max-w-[200px] rounded object-contain"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
