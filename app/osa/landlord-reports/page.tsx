"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ShieldAlert, MessageSquare } from "lucide-react";

type ReportStatus = "Open" | "In Review" | "Resolved";

type OSAReport = {
  id: string;
  tenantName: string;
  roomNo?: string;
  propertyName?: string;
  reason: string;
  details: string;
  status: ReportStatus;
  createdAt: string;
  landlordName: string;
  osaReply?: string | null;
  osaRepliedAt?: string | null;
};

export default function LandlordReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<OSAReport[]>([]);

  const [selectedReport, setSelectedReport] = useState<OSAReport | null>(null);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState<ReportStatus>("In Review");
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/osa/tenant-reports", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        reports?: OSAReport[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load reports");
      setReports(json.reports ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReplySubmit = async () => {
    if (!selectedReport) return;
    setSubmitting(true);
    setReplyError(null);
    try {
      const res = await fetch("/api/osa/tenant-reports", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedReport.id,
          status: replyStatus,
          osaReply: replyText.trim() || undefined,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to update report");
      
      setShowReplyDialog(false);
      setSelectedReport(null);
      setReplyText("");
      void load();
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "Failed to save reply");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case "Resolved":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "In Review":
        return "bg-sky-100 text-sky-800 border-sky-200";
      default:
        return "bg-amber-100 text-amber-800 border-amber-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Landlord Reports</h1>
          <p className="text-sm text-muted-foreground">
            View and respond to incident reports filed by landlords against tenants.
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
          {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4 text-sm text-red-600">{error}</div>
          ) : reports.length === 0 && !loading ? (
            <div className="p-8 text-center text-slate-500">
              <ShieldAlert className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p>No landlord reports have been filed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Landlord</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2" />
                        Loading reports...
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="text-xs whitespace-nowrap text-slate-500">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {report.landlordName}
                          <div className="text-xs text-slate-500 font-normal">
                            {report.propertyName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">{report.tenantName}</div>
                          {report.roomNo && (
                            <div className="text-xs text-slate-500">
                              Room {report.roomNo}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="font-medium text-slate-700 truncate">
                            {report.reason}
                          </div>
                          {report.osaReply && (
                            <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> Replied
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(report.status)}>
                            {report.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[0.7rem]"
                            onClick={() => {
                              setSelectedReport(report);
                              setReplyText(report.osaReply || "");
                              setReplyStatus(report.status === "Open" ? "In Review" : report.status);
                              setShowReplyDialog(true);
                            }}
                          >
                            View & Reply
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {showReplyDialog && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-lg border border-gray-300 bg-white shadow-xl mt-12">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                    Report Details
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Filed by {selectedReport.landlordName} on {new Date(selectedReport.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowReplyDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-xs text-slate-800">
              {replyError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                  {replyError}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 rounded-md border bg-slate-50 p-3">
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tenant</div>
                  <div className="font-medium">{selectedReport.tenantName}</div>
                  <div className="text-slate-500">Room {selectedReport.roomNo || "N/A"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Property</div>
                  <div className="font-medium">{selectedReport.propertyName || "N/A"}</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Reason / Subject</div>
                <div className="font-medium text-sm">{selectedReport.reason}</div>
              </div>

              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Details</div>
                <div className="whitespace-pre-wrap text-slate-700 bg-white border rounded-md p-3">
                  {selectedReport.details}
                </div>
              </div>

              <div className="border-t pt-4 space-y-3 mt-2">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  OSA Response
                </h3>
                
                <div className="space-y-1.5">
                  <label className="text-[0.75rem] font-medium text-slate-700">Update Status</label>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value as ReportStatus)}
                  >
                    <option value="Open">Open</option>
                    <option value="In Review">In Review</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[0.75rem] font-medium text-slate-700">Reply to Landlord</label>
                  <textarea
                    className="min-h-[100px] w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    placeholder="Type your official response here. This will be visible to the landlord..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                  {selectedReport.osaRepliedAt && (
                    <div className="text-[10px] text-slate-500 text-right">
                      Last replied: {new Date(selectedReport.osaRepliedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReplyDialog(false)}
                  className="h-8 text-xs"
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-sky-600 text-white hover:bg-sky-700"
                  onClick={handleReplySubmit}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                  Save Response
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
