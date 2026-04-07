"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Edit3, Eye } from "lucide-react";
import { ProofMedia } from "@/components/proof-media";

function collectFormAttachmentUrls(formData: unknown): string[] {
  if (!formData || typeof formData !== "object") return [];
  const o = formData as Record<string, unknown>;
  const urls: string[] = [];
  const owner = o.owner;
  if (owner && typeof owner === "object") {
    const ow = owner as Record<string, unknown>;
    if (typeof ow.ownerIdFrontUrl === "string") urls.push(ow.ownerIdFrontUrl);
    if (typeof ow.ownerIdBackUrl === "string") urls.push(ow.ownerIdBackUrl);
  }
  if (Array.isArray(o.attachmentUrls)) {
    for (const x of o.attachmentUrls) {
      if (typeof x === "string") urls.push(x);
    }
  }
  return urls;
}

const REQUESTS_PER_PAGE = 5;
const DORMS_PER_PAGE = 5;

type OsaRequestRow = {
  id: string;
  dormName: string;
  owner: string;
  ownerEmail?: string;
  address?: string;
  propertyName?: string | null;
  dateSubmitted: string;
  status: string;
  documentsCount?: number;
};

type OsaAccreditedRow = {
  id: string;
  dormName: string;
  status: string;
  validityPeriod: string;
  compliance: string;
};

function RequestStatusBadge({ status }: { status: string }) {
  const colorClasses =
    status === "Submitted"
      ? "bg-amber-100 text-amber-800"
      : status === "In Review"
        ? "bg-sky-100 text-sky-800"
        : status === "Needs Documents"
          ? "bg-amber-100 text-amber-900"
          : status === "Rejected"
            ? "bg-red-100 text-red-800"
            : status === "Approved"
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

function DormStatusBadge({ status }: { status: string }) {
  const colorClasses =
    status === "Active"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Expiring"
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

function ComplianceBadge({ compliance }: { compliance: string }) {
  const colorClasses =
    compliance === "Compliant"
      ? "bg-emerald-100 text-emerald-800"
      : compliance === "Warning"
        ? "bg-amber-100 text-amber-800"
        : compliance === "Non-Compliant"
          ? "bg-red-100 text-red-800"
          : "bg-slate-100 text-slate-800";

  return (
    <Badge
      className={`${colorClasses} rounded-full px-3 py-1 text-xs font-medium`}
      variant="outline"
    >
      {compliance}
    </Badge>
  );
}

export default function OsaAccreditationPage() {
  const [requests, setRequests] = useState<OsaRequestRow[]>([]);
  const [accredited, setAccredited] = useState<OsaAccreditedRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionSaving, setActionSaving] = useState(false);

  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState<string | "all">("all");

  const [requestPage, setRequestPage] = useState(1);

  const [dormSearch, setDormSearch] = useState("");
  const [dormStatus, setDormStatus] = useState<string | "all">("all");
  const [dormCompliance, setDormCompliance] =
    useState<string | "all">("all");

  const [dormPage, setDormPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<OsaRequestRow | null>(
    null
  );
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showNeedsDocsDialog, setShowNeedsDocsDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [needsDocsNote, setNeedsDocsNote] = useState("");

  const [selectedDorm, setSelectedDorm] = useState<OsaAccreditedRow | null>(
    null
  );
  const [showDormReviewDialog, setShowDormReviewDialog] = useState(false);

  const [requestDetailFormData, setRequestDetailFormData] = useState<
    unknown | null
  >(null);
  const [requestDetailLoading, setRequestDetailLoading] = useState(false);

  const requestAttachmentUrls = useMemo(
    () => collectFormAttachmentUrls(requestDetailFormData),
    [requestDetailFormData]
  );

  const loadData = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/osa/accreditation", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        requests?: OsaRequestRow[];
        accredited?: OsaAccreditedRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setRequests(json.requests ?? []);
      setAccredited(json.accredited ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setRequests([]);
      setAccredited([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showRequestDialog || !selectedRequest?.id) {
      setRequestDetailFormData(null);
      setRequestDetailLoading(false);
      return;
    }
    let cancelled = false;
    setRequestDetailLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/osa/accreditation/${selectedRequest.id}`,
          { credentials: "include" }
        );
        const json = (await res.json()) as {
          formData?: unknown;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setRequestDetailFormData(null);
          return;
        }
        setRequestDetailFormData(json.formData ?? null);
      } catch {
        if (!cancelled) setRequestDetailFormData(null);
      } finally {
        if (!cancelled) setRequestDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showRequestDialog, selectedRequest?.id]);

  useEffect(() => {
    setRequestPage(1);
  }, [requestSearch, requestStatus]);

  useEffect(() => {
    setDormPage(1);
  }, [dormSearch, dormStatus, dormCompliance]);

  const filteredRequests = useMemo(
    () =>
      requests.filter((req) => {
        const matchesSearch =
          requestSearch.trim().length === 0 ||
          req.dormName.toLowerCase().includes(requestSearch.toLowerCase()) ||
          req.owner.toLowerCase().includes(requestSearch.toLowerCase());
        const matchesStatus =
          requestStatus === "all" || req.status === requestStatus;
        return matchesSearch && matchesStatus;
      }),
    [requests, requestSearch, requestStatus]
  );

  const filteredDorms = useMemo(
    () =>
      accredited.filter((dorm) => {
        const matchesSearch =
          dormSearch.trim().length === 0 ||
          dorm.dormName.toLowerCase().includes(dormSearch.toLowerCase());
        const matchesStatus =
          dormStatus === "all" || dorm.status === dormStatus;
        const matchesCompliance =
          dormCompliance === "all" || dorm.compliance === dormCompliance;
        return matchesSearch && matchesStatus && matchesCompliance;
      }),
    [accredited, dormSearch, dormStatus, dormCompliance]
  );

  const requestTotalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / REQUESTS_PER_PAGE) || 1
  );
  const dormTotalPages = Math.max(
    1,
    Math.ceil(filteredDorms.length / DORMS_PER_PAGE) || 1
  );

  const paginatedRequests = useMemo(
    () => {
      const start = (requestPage - 1) * REQUESTS_PER_PAGE;
      const end = start + REQUESTS_PER_PAGE;
      return filteredRequests.slice(start, end);
    },
    [filteredRequests, requestPage]
  );

  const paginatedDorms = useMemo(
    () => {
      const start = (dormPage - 1) * DORMS_PER_PAGE;
      const end = start + DORMS_PER_PAGE;
      return filteredDorms.slice(start, end);
    },
    [filteredDorms, dormPage]
  );

  const handleRequestPageChange = (page: number) => {
    if (page < 1 || page > requestTotalPages) return;
    setRequestPage(page);
  };

  const handleDormPageChange = (page: number) => {
    if (page < 1 || page > dormTotalPages) return;
    setDormPage(page);
  };

  const requestFrom =
    filteredRequests.length === 0
      ? 0
      : (requestPage - 1) * REQUESTS_PER_PAGE + 1;
  const requestTo =
    filteredRequests.length === 0
      ? 0
      : Math.min(requestPage * REQUESTS_PER_PAGE, filteredRequests.length);

  const dormFrom =
    filteredDorms.length === 0 ? 0 : (dormPage - 1) * DORMS_PER_PAGE + 1;
  const dormTo =
    filteredDorms.length === 0
      ? 0
      : Math.min(dormPage * DORMS_PER_PAGE, filteredDorms.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Accreditation
          </h1>
          <p className="text-sm text-muted-foreground">
            Review new accreditation requests and manage accredited dorms.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => void loadData()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {loadError}
        </div>
      )}

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800">
                Accreditation Requests
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Recently submitted dorm accreditation applications.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Search dorm or owner..."
                className="h-8 w-full bg-muted text-xs sm:w-56"
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
              />
              <select
                className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs sm:w-40"
                value={requestStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setRequestStatus(e.target.value as typeof requestStatus)
                }
              >
                <option value="all">All statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="In Review">In Review</option>
                <option value="Needs Documents">Needs Documents</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Dorm Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Date Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-4 font-semibold text-slate-600">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRequests.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    {loading
                      ? "Loading…"
                      : "No open requests. Submissions from landlords appear here."}
                  </TableCell>
                </TableRow>
              )}
              {paginatedRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="text-xs font-mono text-slate-500">
                    {req.id.slice(0, 8)}…
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-800">
                    {req.dormName}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {req.owner}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {req.dateSubmitted}
                  </TableCell>
                  <TableCell>
                    <RequestStatusBadge status={req.status} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                        onClick={() => {
                          setSelectedRequest(req);
                          setShowRequestDialog(true);
                        }}
                      >
                        <Eye className="h-3 w-3" />
                        View Details
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-2 border-t px-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.7rem] text-muted-foreground">
              Showing {requestFrom}–{requestTo} of {filteredRequests.length} requests
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[0.7rem]"
                onClick={() => handleRequestPageChange(requestPage - 1)}
                disabled={requestPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1 text-[0.7rem]">
                {Array.from({ length: requestTotalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <Button
                      key={page}
                      variant={page === requestPage ? "default" : "outline"}
                      size="sm"
                      className="h-7 w-7 px-0 text-[0.7rem]"
                      onClick={() => handleRequestPageChange(page)}
                    >
                      {page}
                    </Button>
                  )
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[0.7rem]"
                onClick={() => handleRequestPageChange(requestPage + 1)}
                disabled={requestPage === requestTotalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800">
                Accredited Dorms
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Currently accredited dormitories and their compliance status.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Search dorm..."
                className="h-8 w-full bg-muted text-xs sm:w-56"
                value={dormSearch}
                onChange={(e) => setDormSearch(e.target.value)}
              />
              <select
                className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs sm:w-40"
                value={dormStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setDormStatus(e.target.value as typeof dormStatus)
                }
              >
                <option value="all">All statuses</option>
                <option value="Active">Active</option>
                <option value="Expiring">Expiring</option>
                <option value="Not Operating">Not Operating</option>
              </select>
              <select
                className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs sm:w-40"
                value={dormCompliance}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setDormCompliance(e.target.value as typeof dormCompliance)
                }
              >
                <option value="all">All compliance</option>
                <option value="Compliant">Compliant</option>
                <option value="Warning">Warning</option>
                <option value="Non-Compliant">Non-Compliant</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Dorm Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Validity Period</TableHead>
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
                    colSpan={6}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    {loading
                      ? "Loading…"
                      : "No approved accreditations yet."}
                  </TableCell>
                </TableRow>
              )}
              {paginatedDorms.map((dorm) => (
                <TableRow key={dorm.id}>
                  <TableCell className="text-xs font-mono text-slate-500">
                    {dorm.id.slice(0, 8)}…
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-800">
                    {dorm.dormName}
                  </TableCell>
                  <TableCell>
                    <DormStatusBadge status={dorm.status} />
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {dorm.validityPeriod}
                  </TableCell>
                  <TableCell>
                    <ComplianceBadge compliance={dorm.compliance} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-2 text-[0.7rem] flex items-center gap-1"
                        onClick={() => {
                          setSelectedDorm(dorm);
                          setShowDormReviewDialog(true);
                        }}
                      >
                        <Edit3 className="h-3 w-3" />
                        Review
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-2 border-t px-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.7rem] text-muted-foreground">
              Showing {dormFrom}–{dormTo} of {filteredDorms.length} dorms
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[0.7rem]"
                onClick={() => handleDormPageChange(dormPage - 1)}
                disabled={dormPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1 text-[0.7rem]">
                {Array.from({ length: dormTotalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <Button
                      key={page}
                      variant={page === dormPage ? "default" : "outline"}
                      size="sm"
                      className="h-7 w-7 px-0 text-[0.7rem]"
                      onClick={() => handleDormPageChange(page)}
                    >
                      {page}
                    </Button>
                  )
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[0.7rem]"
                onClick={() => handleDormPageChange(dormPage + 1)}
                disabled={dormPage === dormTotalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showRequestDialog && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Dorm Accreditation Request
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowRequestDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-xs text-slate-800">
              <div className="space-y-2">
                <div className="grid gap-2 md:grid-cols-[130px,1fr] items-center">
                  <span className="text-[0.7rem]">Dorm Name:</span>
                  <Input value={selectedRequest.dormName} readOnly className="h-8 text-xs" />
                  <span className="text-[0.7rem]">Owner:</span>
                  <Input value={selectedRequest.owner} readOnly className="h-8 text-xs" />
                  <span className="text-[0.7rem]">Property (landlord):</span>
                  <Input
                    value={selectedRequest.propertyName ?? "—"}
                    readOnly
                    className="h-8 text-xs"
                  />
                  <span className="text-[0.7rem]">Address:</span>
                  <Input
                    value={selectedRequest.address ?? "—"}
                    readOnly
                    className="h-8 text-xs"
                  />
                  <span className="text-[0.7rem]">Documents (count):</span>
                  <Input
                    value={String(selectedRequest.documentsCount ?? 0)}
                    readOnly
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Submitted attachments
                </p>
                <p className="text-[0.65rem] text-muted-foreground">
                  Files the landlord uploaded with this application (IDs,
                  permits, certificates). PDFs open in a new tab.
                </p>
                {requestDetailLoading ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    Loading attachments…
                  </p>
                ) : requestAttachmentUrls.length === 0 ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    No file URLs stored for this request. Older submissions may
                    only list document names without uploads.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {requestAttachmentUrls.map((url) => (
                      <div
                        key={url}
                        className="rounded-md border border-slate-200 bg-slate-50 p-2"
                      >
                        <ProofMedia
                          url={url}
                          className="max-h-44 w-full rounded object-contain"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    setShowRequestDialog(false);
                    setNeedsDocsNote("");
                    setShowNeedsDocsDialog(true);
                  }}
                >
                  Request documents
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    setShowRequestDialog(false);
                    setRejectReason("");
                    setShowRejectDialog(true);
                  }}
                >
                  Reject application
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs bg-emerald-500 text-white hover:bg-emerald-600"
                  onClick={() => {
                    setShowRequestDialog(false);
                    setShowApproveConfirm(true);
                  }}
                >
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Approve confirmation dialog */}
      {showApproveConfirm && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <CardTitle className="text-base font-semibold text-slate-900">
                Approve accreditation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <p>
                Mark{" "}
                <span className="font-semibold">{selectedRequest.dormName}</span>{" "}
                as approved in the system. The landlord will see this status on
                their accreditation page.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={actionSaving}
                  onClick={() => setShowApproveConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs bg-emerald-500 text-white hover:bg-emerald-600"
                  disabled={actionSaving}
                  onClick={async () => {
                    if (!selectedRequest) return;
                    setActionSaving(true);
                    setLoadError(null);
                    try {
                      const res = await fetch(
                        `/api/osa/accreditation/${selectedRequest.id}`,
                        {
                          method: "PATCH",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "Approved" }),
                        }
                      );
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setShowApproveConfirm(false);
                      setShowRequestDialog(false);
                      await loadData();
                    } catch (e) {
                      setLoadError(
                        e instanceof Error ? e.message : "Failed to approve"
                      );
                    } finally {
                      setActionSaving(false);
                    }
                  }}
                >
                  {actionSaving ? "Saving…" : "Confirm approve"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reject application (terminal) */}
      {showRejectDialog && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <CardTitle className="text-base font-semibold text-slate-900">
                Reject accreditation application
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <p>
                This permanently rejects the application for{" "}
                <span className="font-semibold">{selectedRequest.dormName}</span>
                . The landlord may submit a new application later.
              </p>
              <textarea
                className="w-full min-h-[90px] rounded-md border border-slate-300 px-2 py-1 text-xs"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (required)…"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowRejectDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={!rejectReason.trim() || actionSaving}
                  onClick={async () => {
                    if (!selectedRequest || !rejectReason.trim()) return;
                    setActionSaving(true);
                    setLoadError(null);
                    try {
                      const res = await fetch(
                        `/api/osa/accreditation/${selectedRequest.id}`,
                        {
                          method: "PATCH",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            status: "Rejected",
                            remarks: rejectReason.trim(),
                          }),
                        }
                      );
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setShowRejectDialog(false);
                      setShowRequestDialog(false);
                      setRejectReason("");
                      await loadData();
                    } catch (e) {
                      setLoadError(
                        e instanceof Error ? e.message : "Failed to reject"
                      );
                    } finally {
                      setActionSaving(false);
                    }
                  }}
                >
                  {actionSaving ? "Saving…" : "Confirm rejection"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Request additional documents */}
      {showNeedsDocsDialog && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <CardTitle className="text-base font-semibold text-slate-900">
                Request additional documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <p>
                The landlord will be asked to supply more documentation for{" "}
                <span className="font-semibold">{selectedRequest.dormName}</span>.
              </p>
              <textarea
                className="w-full min-h-[90px] rounded-md border border-slate-300 px-2 py-1 text-xs"
                value={needsDocsNote}
                onChange={(e) => setNeedsDocsNote(e.target.value)}
                placeholder="List required documents or clarifications…"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowNeedsDocsDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={!needsDocsNote.trim() || actionSaving}
                  onClick={async () => {
                    if (!selectedRequest || !needsDocsNote.trim()) return;
                    setActionSaving(true);
                    setLoadError(null);
                    try {
                      const res = await fetch(
                        `/api/osa/accreditation/${selectedRequest.id}`,
                        {
                          method: "PATCH",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            status: "Needs Documents",
                            remarks: needsDocsNote.trim(),
                          }),
                        }
                      );
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setShowNeedsDocsDialog(false);
                      setShowRequestDialog(false);
                      setNeedsDocsNote("");
                      await loadData();
                    } catch (e) {
                      setLoadError(
                        e instanceof Error ? e.message : "Failed to update"
                      );
                    } finally {
                      setActionSaving(false);
                    }
                  }}
                >
                  {actionSaving ? "Saving…" : "Send request"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dorm review dialog */}
      {showDormReviewDialog && selectedDorm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Dorm Accreditation Review
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    View accreditation information for this dorm.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowDormReviewDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {selectedDorm.dormName}
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Accreditation ID:{" "}
                  <span className="font-mono">{selectedDorm.id}</span>
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-[0.75rem] font-semibold text-slate-900">
                    Status
                  </p>
                  <DormStatusBadge status={selectedDorm.status} />
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    Validity Period:
                    <span className="ml-1 font-medium text-slate-900">
                      {selectedDorm.validityPeriod}
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[0.75rem] font-semibold text-slate-900">
                    Compliance
                  </p>
                  <ComplianceBadge compliance={selectedDorm.compliance} />
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    This indicates whether the dorm meets all required safety and
                    document standards.
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[0.7rem] text-slate-700">
                <p>
                  This dorm&apos;s record shows whether its accreditation is
                  currently approved and within the validity period. For full
                  application details (uploaded documents, safety declarations,
                  and remarks), open the corresponding accreditation request
                  under the Requests table.
                </p>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowDormReviewDialog(false)}
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

