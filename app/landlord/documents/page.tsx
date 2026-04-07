"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  uploadDormConnectFile,
  uploadDormConnectFiles,
} from "@/lib/upload-file-client";
import { ProofMedia } from "@/components/proof-media";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilePlus2, Eye, Loader2 } from "lucide-react";

type RequestStatus =
  | "Submitted"
  | "In Review"
  | "Approved"
  | "Rejected"
  | "Needs Documents";

const ROWS_PER_PAGE = 5;

type AccreditationRow = {
  id: string;
  dormName: string;
  address: string;
  documentsCount: number;
  submittedDate: string;
  status: RequestStatus;
};

function StatusBadge({ status }: { status: RequestStatus }) {
  const colorClasses =
    status === "Approved"
      ? "bg-emerald-100 text-emerald-800"
      : status === "In Review"
        ? "bg-blue-100 text-blue-800"
        : status === "Submitted"
          ? "bg-slate-100 text-slate-800"
          : status === "Rejected"
            ? "bg-red-100 text-red-800"
            : "bg-amber-100 text-amber-900";

  return (
    <Badge
      className={`${colorClasses} rounded-full px-3 py-1 text-xs font-medium`}
      variant="outline"
    >
      {status}
    </Badge>
  );
}

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

export default function LandlordDocumentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<AccreditationRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step A – Dorm information
  const [dormName, setDormName] = useState("");
  const [dormAddress, setDormAddress] = useState("");
  const [dormCity, setDormCity] = useState("");
  const [dormContact, setDormContact] = useState("");
  const [dormEmail, setDormEmail] = useState("");
  const [dormType, setDormType] = useState("Co-ed");
  const [dormRooms, setDormRooms] = useState("");
  const [dormCapacity, setDormCapacity] = useState("");

  // Step B – Owner / landlord information
  const [ownerName, setOwnerName] = useState("");
  const [ownerBusinessName, setOwnerBusinessName] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerIdFrontFile, setOwnerIdFrontFile] = useState<File | null>(null);
  const [ownerIdBackFile, setOwnerIdBackFile] = useState<File | null>(null);

  // Step C – Required documents (files stored for upload on submit)
  const [accreditationDocFiles, setAccreditationDocFiles] = useState<File[]>(
    []
  );

  // Step D – Safety & compliance
  const [safetyExits, setSafetyExits] = useState(false);
  const [safetyExtinguishers, setSafetyExtinguishers] = useState(false);
  const [safetyContacts, setSafetyContacts] = useState(false);
  const [safetyRooms, setSafetyRooms] = useState(false);

  // Step E – Declaration
  const [declName, setDeclName] = useState("");
  const [declSignature, setDeclSignature] = useState("");
  const [declDate, setDeclDate] = useState("");
  const [selectedRequest, setSelectedRequest] =
    useState<AccreditationRow | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsFormData, setDetailsFormData] = useState<unknown>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/landlord/accreditation", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        requests?: AccreditationRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setRequests(json.requests ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRequests = useMemo(
    () =>
      requests.filter((req) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return (
          req.id.toLowerCase().includes(query) ||
          req.dormName.toLowerCase().includes(query) ||
          req.address.toLowerCase().includes(query)
        );
      }),
    [requests, search]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / ROWS_PER_PAGE)
  );

  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return filteredRequests.slice(start, end);
  }, [filteredRequests, page]);

  const from =
    filteredRequests.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1;
  const to =
    filteredRequests.length === 0
      ? 0
      : Math.min(page * ROWS_PER_PAGE, filteredRequests.length);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(1, totalPages)));
  }, [totalPages]);

  useEffect(() => {
    if (!showDetailsDialog || !selectedRequest) {
      setDetailsFormData(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/landlord/accreditation/${selectedRequest.id}`,
          { credentials: "include" }
        );
        const j = (await res.json()) as { formData?: unknown };
        if (!cancelled && res.ok) setDetailsFormData(j.formData ?? null);
      } catch {
        if (!cancelled) setDetailsFormData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showDetailsDialog, selectedRequest]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Accreditation Documents
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload and track documents required for dorm accreditation.
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => void loadData()}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Loading…
              </>
            ) : (
              "Refresh"
            )}
          </Button>
          <Button
            className="h-8 bg-emerald-500 px-3 text-xs font-medium text-white hover:bg-emerald-600 flex items-center gap-1"
            type="button"
            onClick={() => {
              setWizardStep(1);
              setOwnerIdFrontFile(null);
              setOwnerIdBackFile(null);
              setAccreditationDocFiles([]);
              setShowWizard(true);
            }}
          >
            <FilePlus2 className="h-3 w-3" />
            Apply for Accreditation
          </Button>
        </div>
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
                Submitted accreditation applications and their review status.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Search ID, dorm, or address..."
                className="h-8 w-full bg-muted text-xs sm:w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Table bordered={false}>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Dorm Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Submitted Date</TableHead>
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
                    colSpan={7}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    {loading
                      ? "Loading…"
                      : "No accreditation requests yet. Submit one with the button above."}
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
                    {req.address}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {req.documentsCount} documents submitted
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {req.submittedDate}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={req.status} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                        onClick={() => {
                          setSelectedRequest(req);
                          setShowDetailsDialog(true);
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
              Showing {from}–{to} of {filteredRequests.length} requests
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[0.7rem]"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1 text-[0.7rem]">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      className="h-7 w-7 px-0 text-[0.7rem]"
                      onClick={() => handlePageChange(p)}
                    >
                      {p}
                    </Button>
                  )
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[0.7rem]"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Apply for Accreditation wizard */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-2xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Apply For Accreditation
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowWizard(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-xs text-slate-800">
              {wizardStep === 1 && (
                <div className="space-y-3">
                  <p className="text-[0.8rem] font-semibold text-slate-900">
                    A. Dorm Information
                  </p>
                  <div className="grid gap-2 md:grid-cols-[140px,1fr] items-center">
                    <span className="text-[0.7rem] text-slate-700">
                      Dorm Name:
                    </span>
                    <Input
                      value={dormName}
                      onChange={(e) => setDormName(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      Dorm Address:
                    </span>
                    <Input
                      value={dormAddress}
                      onChange={(e) => setDormAddress(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      City / Municipality:
                    </span>
                    <Input
                      value={dormCity}
                      onChange={(e) => setDormCity(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      Contact Number:
                    </span>
                    <Input
                      value={dormContact}
                      onChange={(e) => setDormContact(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      Email Address:
                    </span>
                    <Input
                      type="email"
                      value={dormEmail}
                      onChange={(e) => setDormEmail(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      Dorm Type:
                    </span>
                    <select
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                      value={dormType}
                      onChange={(e) => setDormType(e.target.value)}
                    >
                      <option value="Co-ed">Co-ed</option>
                      <option value="Male">Male only</option>
                      <option value="Female">Female only</option>
                    </select>
                    <span className="text-[0.7rem] text-slate-700">
                      Number of Rooms:
                    </span>
                    <Input
                      type="number"
                      value={dormRooms}
                      onChange={(e) => setDormRooms(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      Total Capacity:
                    </span>
                    <Input
                      type="number"
                      value={dormCapacity}
                      onChange={(e) => setDormCapacity(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setWizardStep(2)}
                    >
                      Next Page &rarr;
                    </Button>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-3">
                  <p className="text-[0.8rem] font-semibold text-slate-900">
                    B. Owner / Landlord Information
                  </p>
                  <div className="grid gap-2 md:grid-cols-[160px,1fr] items-center">
                    <span className="text-[0.7rem] text-slate-700">
                      Full Name:
                    </span>
                    <Input
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      Business Name:
                    </span>
                    <Input
                      value={ownerBusinessName}
                      onChange={(e) => setOwnerBusinessName(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      Contact Number:
                    </span>
                    <Input
                      value={ownerContact}
                      onChange={(e) => setOwnerContact(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      Email Address:
                    </span>
                    <Input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[0.75rem] font-semibold text-slate-900">
                      Upload Valid ID
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
                        <p className="text-[0.75rem] font-medium text-slate-800">
                          Front
                        </p>
                        <Input
                          type="file"
                          accept="image/*"
                          className="h-8 cursor-pointer text-xs"
                          onChange={(e) => {
                            setOwnerIdFrontFile(e.target.files?.[0] ?? null);
                          }}
                        />
                        {ownerIdFrontFile && (
                          <p className="text-[0.65rem] text-muted-foreground">
                            {ownerIdFrontFile.name}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
                        <p className="text-[0.75rem] font-medium text-slate-800">
                          Back
                        </p>
                        <Input
                          type="file"
                          accept="image/*"
                          className="h-8 cursor-pointer text-xs"
                          onChange={(e) => {
                            setOwnerIdBackFile(e.target.files?.[0] ?? null);
                          }}
                        />
                        {ownerIdBackFile && (
                          <p className="text-[0.65rem] text-muted-foreground">
                            {ownerIdBackFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setWizardStep(3)}
                    >
                      Next Page &rarr;
                    </Button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-3">
                  <p className="text-[0.8rem] font-semibold text-slate-900">
                    C. Required Documents (Upload)
                  </p>
                  <div className="space-y-1 text-[0.7rem] text-slate-800">
                    <p>Business Permit</p>
                    <p>Barangay Clearance</p>
                    <p>Fire Safety Certificate</p>
                    <p>Occupancy Permit</p>
                    <p>Sanitary Permit (if applicable)</p>
                    <p>
                      Other Supporting Documents:{" "}
                      <span className="text-slate-500">
                        (e.g. lease contract, photos, etc.)
                      </span>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[0.75rem] font-semibold text-slate-900">
                      Upload Documents
                    </p>
                    <div className="min-h-[120px] rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                      <Input
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        className="h-8 cursor-pointer text-xs"
                        onChange={(e) => {
                          setAccreditationDocFiles(
                            Array.from(e.target.files ?? [])
                          );
                        }}
                      />
                      {accreditationDocFiles.length > 0 && (
                        <ul className="mt-2 list-disc pl-4 text-[0.65rem] text-slate-700">
                          {accreditationDocFiles.map((file) => (
                            <li key={file.name}>{file.name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setWizardStep(4)}
                    >
                      Next Page &rarr;
                    </Button>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-3">
                  <p className="text-[0.8rem] font-semibold text-slate-900">
                    D. Safety & Compliance Declaration
                  </p>
                  <p className="text-[0.7rem] text-slate-800">
                    Please confirm the following:
                  </p>
                  <div className="space-y-2 text-[0.7rem]">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={safetyExits}
                        onChange={(e) => setSafetyExits(e.target.checked)}
                      />
                      Fire exits are properly marked and accessible.
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={safetyExtinguishers}
                        onChange={(e) =>
                          setSafetyExtinguishers(e.target.checked)
                        }
                      />
                      Fire extinguishers are available and functional.
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={safetyContacts}
                        onChange={(e) => setSafetyContacts(e.target.checked)}
                      />
                      Emergency contact numbers are posted.
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={safetyRooms}
                        onChange={(e) => setSafetyRooms(e.target.checked)}
                      />
                      Rooms meet minimum space and ventilation requirements.
                    </label>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setWizardStep(5)}
                    >
                      Next Page &rarr;
                    </Button>
                  </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div className="space-y-3">
                  <p className="text-[0.8rem] font-semibold text-slate-900">
                    E. Declaration
                  </p>
                  <p className="text-[0.7rem] text-slate-800">
                    I hereby certify that all information provided in this
                    application is true, complete, and accurate to the best of
                    my knowledge.
                  </p>
                  <div className="space-y-1 text-[0.7rem] text-slate-800">
                    <p>I understand that:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Submission does not guarantee approval.</li>
                      <li>
                        Accreditation may be revoked if compliance is violated.
                      </li>
                      <li>
                        OSA reserves the right to inspect the premises.
                      </li>
                    </ul>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[140px,1fr] items-center">
                    <span className="text-[0.7rem] text-slate-700">
                      Applicant Name:
                    </span>
                    <Input
                      value={declName}
                      onChange={(e) => setDeclName(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      Signature:
                    </span>
                    <Input
                      value={declSignature}
                      onChange={(e) => setDeclSignature(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      Date:
                    </span>
                    <Input
                      type="date"
                      value={declDate}
                      onChange={(e) => setDeclDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setShowWizard(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      disabled={
                        submitting ||
                        !dormName.trim() ||
                        !dormAddress.trim() ||
                        !declName.trim()
                      }
                      onClick={async () => {
                        const address = [dormAddress.trim(), dormCity.trim()]
                          .filter(Boolean)
                          .join(", ");
                        setSubmitting(true);
                        try {
                          let ownerIdFrontUrl: string | undefined;
                          let ownerIdBackUrl: string | undefined;
                          if (ownerIdFrontFile) {
                            ownerIdFrontUrl = await uploadDormConnectFile(
                              ownerIdFrontFile
                            );
                          }
                          if (ownerIdBackFile) {
                            ownerIdBackUrl = await uploadDormConnectFile(
                              ownerIdBackFile
                            );
                          }
                          const attachmentUrls =
                            accreditationDocFiles.length > 0
                              ? await uploadDormConnectFiles(
                                  accreditationDocFiles
                                )
                              : [];
                          const documentsCount =
                            attachmentUrls.length +
                            (ownerIdFrontUrl ? 1 : 0) +
                            (ownerIdBackUrl ? 1 : 0);
                          const res = await fetch("/api/landlord/accreditation", {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              dormName: dormName.trim(),
                              address,
                              documentsCount,
                              formData: {
                                dorm: {
                                  name: dormName,
                                  address: dormAddress,
                                  city: dormCity,
                                  contact: dormContact,
                                  email: dormEmail,
                                  type: dormType,
                                  rooms: dormRooms,
                                  capacity: dormCapacity,
                                },
                                owner: {
                                  name: ownerName,
                                  businessName: ownerBusinessName,
                                  contact: ownerContact,
                                  email: ownerEmail,
                                  idFrontFileName: ownerIdFrontFile?.name,
                                  idBackFileName: ownerIdBackFile?.name,
                                  ownerIdFrontUrl,
                                  ownerIdBackUrl,
                                },
                                documentFileNames: accreditationDocFiles.map(
                                  (f) => f.name
                                ),
                                attachmentUrls,
                                safety: {
                                  exits: safetyExits,
                                  extinguishers: safetyExtinguishers,
                                  contacts: safetyContacts,
                                  rooms: safetyRooms,
                                },
                                declaration: {
                                  name: declName,
                                  signature: declSignature,
                                  date: declDate,
                                },
                              },
                            }),
                          });
                          const j = (await res.json()) as { error?: string };
                          if (!res.ok) throw new Error(j.error ?? "Failed");
                          setShowWizard(false);
                          setOwnerIdFrontFile(null);
                          setOwnerIdBackFile(null);
                          setAccreditationDocFiles([]);
                          await loadData();
                        } catch (e) {
                          setLoadError(
                            e instanceof Error ? e.message : "Submit failed"
                          );
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    >
                      {submitting ? "Submitting…" : "Submit"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accreditation request view details dialog */}
      {showDetailsDialog && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-2xl border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Accreditation Request Details
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Overview of this dorm&apos;s accreditation application.
                  </p>
                </div>
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
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {selectedRequest.dormName}
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Request ID:{" "}
                  <span className="font-mono">{selectedRequest.id}</span>
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Address:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedRequest.address}
                  </span>
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Submitted Date:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedRequest.submittedDate}
                  </span>
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Status
                </p>
                <StatusBadge status={selectedRequest.status} />
                <p className="text-[0.7rem] text-muted-foreground mt-1">
                  Documents submitted:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedRequest.documentsCount}
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Uploaded files (stored on server)
                </p>
                {collectFormAttachmentUrls(detailsFormData).length === 0 ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    No file attachments found for this request (older
                    submissions may only have file names in the record).
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {collectFormAttachmentUrls(detailsFormData).map((url) => (
                      <div
                        key={url}
                        className="rounded-md border border-slate-200 bg-slate-50 p-2"
                      >
                        <ProofMedia
                          url={url}
                          className="max-h-40 w-full rounded object-contain"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[0.7rem] text-slate-700">
                <p>
                  OSA staff can review the same attachments from their
                  accreditation tools. To change data after submission, contact
                  OSA or submit a new application if allowed.
                </p>
              </div>

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

