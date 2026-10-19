"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ShieldAlert } from "lucide-react";

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
  osaReply?: string | null;
  osaRepliedAt?: string | null;
};

type Tenant = {
  id: string;
  roomNo: string;
  name: string;
  propertyName?: string;
  reservationId?: string | null;
};

export type TenantReportsPanelProps = {
  embedded?: boolean;
};

export function TenantReportsPanel({ embedded = false }: TenantReportsPanelProps = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<OSAReport[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportTenantId, setReportTenantId] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<OSAReport | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [rRes, tRes] = await Promise.all([
        fetch("/api/landlord/reports/osa", { credentials: "include" }),
        fetch("/api/landlord/leases", { credentials: "include" })
      ]);

      const rj = (await rRes.json()) as { reports?: OSAReport[]; error?: string };
      const tj = (await tRes.json()) as { leases?: Tenant[]; error?: string };

      if (!rRes.ok) throw new Error(rj.error ?? "Failed to load reports");

      setReports(rj.reports ?? []);
      setTenants(tj.leases ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setReports([]);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitReport = async () => {
    const selectedTenant = tenants.find((t) => t.id === reportTenantId);
    if (!selectedTenant || !reportTitle.trim() || !reportDescription.trim()) {
      setReportError("Please select a tenant and provide a reason and details.");
      return;
    }
    setReporting(true);
    setReportError(null);
    try {
      const res = await fetch("/api/landlord/reports/osa", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaseId: selectedTenant.id,
          tenantName: selectedTenant.name,
          propertyName: selectedTenant.propertyName,
          roomNo: selectedTenant.roomNo,
          title: reportTitle.trim(),
          description: reportDescription.trim(),
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to submit report");
      setShowReportDialog(false);
      setReportTenantId("");
      setReportTitle("");
      setReportDescription("");
      void load();
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "Failed to submit report");
    } finally {
      setReporting(false);
    }
  };

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case "Resolved": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "In Review": return "bg-sky-100 text-sky-800 border-sky-200";
      default: return "bg-amber-100 text-amber-800 border-amber-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tenant Reports</h1>
            <p className="text-sm text-muted-foreground">
              Manage and view formal reports submitted to the Office of Student Affairs.
            </p>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            type="button"
            className="h-8 px-3 text-xs font-medium flex items-center gap-1 bg-amber-600 text-white hover:bg-amber-700"
            onClick={() => {
              setReportTenantId(tenants[0]?.id ?? "");
              setReportTitle("");
              setReportDescription("");
              setShowReportDialog(true);
            }}
          >
            <ShieldAlert className="h-3 w-3" />
            Report Tenant
          </Button>
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
      </div>

      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4 text-sm text-red-600">{error}</div>
          ) : reports.length === 0 && !loading ? (
            <div className="p-8 text-center text-slate-500">
              <ShieldAlert className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p>No tenant reports have been filed.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Status</TableHead>
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
                      <TableCell>
                        <div className="font-medium text-slate-900">{report.tenantName}</div>
                        {(report.roomNo || report.propertyName) && (
                          <div className="text-xs text-slate-500">
                            {report.propertyName} {report.roomNo ? `· Room ${report.roomNo}` : ''}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-slate-700">
                        {report.reason}
                      </TableCell>
                      <TableCell className="max-w-[300px] text-slate-500">
                        <div className="truncate">{report.details}</div>
                      </TableCell>
                      <TableCell className="text-right">
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
                            setShowDetailsDialog(true);
                          }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showDetailsDialog && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-md border border-gray-300 bg-white shadow-xl mt-12">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-600" />
                  Report Details
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
            <CardContent className="space-y-4 pt-4 text-xs text-slate-800">
              <div className="grid grid-cols-2 gap-4 rounded-md border bg-slate-50 p-3">
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tenant</div>
                  <div className="font-medium">{selectedReport.tenantName}</div>
                  <div className="text-slate-500">Room {selectedReport.roomNo || "N/A"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</div>
                  <Badge variant="outline" className={getStatusColor(selectedReport.status)}>
                    {selectedReport.status}
                  </Badge>
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

              {selectedReport.osaReply && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="font-semibold text-sm flex items-center gap-1.5 mb-2 text-sky-800">
                    <ShieldAlert className="h-4 w-4" />
                    OSA Response
                  </h3>
                  <div className="rounded-md bg-sky-50 p-3 text-sky-900 text-xs border border-sky-200 whitespace-normal">
                    {selectedReport.osaReply}
                    {selectedReport.osaRepliedAt && (
                      <div className="text-[10px] text-sky-700 mt-2 text-right">
                        Replied at {new Date(selectedReport.osaRepliedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showReportDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-md border border-gray-300 bg-white shadow-xl mt-12">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-amber-700 flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5" />
                    Report Tenant to OSA
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Submit a formal report to the University Office of Student Affairs regarding a tenant's behavior or rule violations.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowReportDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              {reportError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                  {reportError}
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-[0.75rem] font-medium text-slate-700">Select Tenant</label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                  value={reportTenantId}
                  onChange={(e) => setReportTenantId(e.target.value)}
                >
                  <option value="" disabled>-- Select a tenant --</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Room {t.roomNo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[0.75rem] font-medium text-slate-700">Reason / Subject</label>
                <Input
                  placeholder="e.g. Unpaid Rent, Destructive Behavior..."
                  className="h-8 text-xs"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[0.75rem] font-medium text-slate-700">Details</label>
                <textarea
                  className="min-h-[100px] w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Please describe the issue in detail..."
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReportDialog(false)}
                  className="h-8 text-xs"
                  disabled={reporting}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-amber-600 text-white hover:bg-amber-700"
                  onClick={submitReport}
                  disabled={reporting || !reportTitle.trim() || !reportDescription.trim() || !reportTenantId}
                >
                  {reporting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                  Submit Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
