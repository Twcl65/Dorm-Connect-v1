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
  // Prefer the explicit, flattened `attachmentUrls` list when present.
  // Otherwise, fall back to reading owner/docs/supporting from the structured form.
  if (Array.isArray(o.attachmentUrls)) {
    const urls = o.attachmentUrls.filter(
      (x): x is string => typeof x === "string"
    );
    return Array.from(new Set(urls));
  }

  const urls: string[] = [];
  const owner = o.owner;
  if (owner && typeof owner === "object") {
    const ow = owner as Record<string, unknown>;
    if (typeof ow.ownerIdFrontUrl === "string") urls.push(ow.ownerIdFrontUrl);
    if (typeof ow.ownerIdBackUrl === "string") urls.push(ow.ownerIdBackUrl);
  }

  const docs = o.documents;
  if (docs && typeof docs === "object") {
    const d = docs as Record<string, unknown>;
    for (const key of [
      "businessPermit",
      "barangayClearance",
      "fireSafetyCertificate",
      "occupancyPermit",
      "sanitaryPermit",
      "signature",
    ]) {
      const v = d[key];
      if (v && typeof v === "object") {
        const vv = v as Record<string, unknown>;
        if (typeof vv.url === "string") urls.push(vv.url);
      }
    }
    const supporting = d.supporting;
    if (supporting && typeof supporting === "object") {
      const s = supporting as Record<string, unknown>;
      if (Array.isArray(s.urls)) {
        for (const x of s.urls) if (typeof x === "string") urls.push(x);
      }
    }
  }

  return Array.from(new Set(urls));
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

  // Step C – Required documents (segregated uploads)
  const [businessPermitFile, setBusinessPermitFile] = useState<File | null>(
    null
  );
  const [barangayClearanceFile, setBarangayClearanceFile] =
    useState<File | null>(null);
  const [fireSafetyCertFile, setFireSafetyCertFile] = useState<File | null>(
    null
  );
  const [occupancyPermitFile, setOccupancyPermitFile] = useState<File | null>(
    null
  );
  const [sanitaryApplicable, setSanitaryApplicable] = useState(false);
  const [sanitaryPermitFile, setSanitaryPermitFile] = useState<File | null>(
    null
  );
  const [supportingDocFiles, setSupportingDocFiles] = useState<File[]>([]);

  // Step D – Safety & compliance
  const [safetyExits, setSafetyExits] = useState(false);
  const [safetyExtinguishers, setSafetyExtinguishers] = useState(false);
  const [safetyContacts, setSafetyContacts] = useState(false);
  const [safetyRooms, setSafetyRooms] = useState(false);

  // Step E – Declaration
  const [declName, setDeclName] = useState("");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [wizardErrors, setWizardErrors] = useState<string[]>([]);
  const [selectedRequest, setSelectedRequest] =
    useState<AccreditationRow | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsFormData, setDetailsFormData] = useState<unknown>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

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
      setDetailsLoading(false);
      return;
    }
    setDetailsLoading(true);
    // Prevent showing attachments from a previously selected request while loading.
    setDetailsFormData(null);
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
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showDetailsDialog, selectedRequest]);

  useEffect(() => {
    if (!showWizard) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showWizard]);

  const validateWizardStep = useCallback(
    (step: 1 | 2 | 3 | 4 | 5): string[] => {
      const errors: string[] = [];
      if (step === 1) {
        if (!dormName.trim()) errors.push("Dorm name is required.");
        if (!dormAddress.trim()) errors.push("Dorm address is required.");
        if (!dormCity.trim()) errors.push("City / municipality is required.");
        if (!dormContact.trim()) errors.push("Contact number is required.");
        if (!dormEmail.trim()) errors.push("Email address is required.");
        if (!dormRooms.trim()) errors.push("Number of rooms is required.");
        if (!dormCapacity.trim()) errors.push("Total capacity is required.");
      }
      if (step === 2) {
        if (!ownerName.trim()) errors.push("Owner full name is required.");
        if (!ownerBusinessName.trim())
          errors.push("Business name is required.");
        if (!ownerContact.trim()) errors.push("Owner contact number is required.");
        if (!ownerEmail.trim()) errors.push("Owner email address is required.");
        if (!ownerIdFrontFile) errors.push("Valid ID (front) is required.");
        if (!ownerIdBackFile) errors.push("Valid ID (back) is required.");
      }
      if (step === 3) {
        if (!businessPermitFile) errors.push("Business Permit is required.");
        if (!barangayClearanceFile)
          errors.push("Barangay Clearance is required.");
        if (!fireSafetyCertFile)
          errors.push("Fire Safety Certificate is required.");
        if (!occupancyPermitFile) errors.push("Occupancy Permit is required.");
        if (sanitaryApplicable && !sanitaryPermitFile) {
          errors.push("Sanitary Permit is required if applicable.");
        }
      }
      if (step === 4) {
        if (!safetyExits)
          errors.push("Confirm fire exits are marked and accessible.");
        if (!safetyExtinguishers)
          errors.push("Confirm fire extinguishers are available and functional.");
        if (!safetyContacts)
          errors.push("Confirm emergency contact numbers are posted.");
        if (!safetyRooms)
          errors.push("Confirm rooms meet minimum requirements.");
      }
      if (step === 5) {
        if (!declName.trim()) errors.push("Applicant name is required.");
        if (!signatureFile) errors.push("Applicant signature upload is required.");
      }
      return errors;
    },
    [
      dormName,
      dormAddress,
      dormCity,
      dormContact,
      dormEmail,
      dormRooms,
      dormCapacity,
      ownerName,
      ownerBusinessName,
      ownerContact,
      ownerEmail,
      ownerIdFrontFile,
      ownerIdBackFile,
      businessPermitFile,
      barangayClearanceFile,
      fireSafetyCertFile,
      occupancyPermitFile,
      sanitaryApplicable,
      sanitaryPermitFile,
      safetyExits,
      safetyExtinguishers,
      safetyContacts,
      safetyRooms,
      declName,
      signatureFile,
    ]
  );

  const goNext = useCallback(() => {
    const errs = validateWizardStep(wizardStep);
    if (errs.length > 0) {
      setWizardErrors(errs);
      return;
    }
    setWizardErrors([]);
    setWizardStep((s) => (s < 5 ? ((s + 1) as 2 | 3 | 4 | 5) : s));
  }, [validateWizardStep, wizardStep]);

  const goBack = useCallback(() => {
    setWizardErrors([]);
    setWizardStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s));
  }, []);

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
              setBusinessPermitFile(null);
              setBarangayClearanceFile(null);
              setFireSafetyCertFile(null);
              setOccupancyPermitFile(null);
              setSanitaryApplicable(false);
              setSanitaryPermitFile(null);
              setSupportingDocFiles([]);
              setSignatureFile(null);
              setWizardErrors([]);
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
                              setDetailsFormData(null);
                              setDetailsLoading(false);
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
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
              {wizardErrors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[0.7rem] text-red-800">
                  <p className="font-semibold">Please complete the required items:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {wizardErrors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
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
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setShowWizard(false)}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={goNext}
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
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={goBack}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={goNext}
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
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        {
                          label: "Business Permit",
                          file: businessPermitFile,
                          set: setBusinessPermitFile,
                        },
                        {
                          label: "Barangay Clearance",
                          file: barangayClearanceFile,
                          set: setBarangayClearanceFile,
                        },
                        {
                          label: "Fire Safety Certificate",
                          file: fireSafetyCertFile,
                          set: setFireSafetyCertFile,
                        },
                        {
                          label: "Occupancy Permit",
                          file: occupancyPermitFile,
                          set: setOccupancyPermitFile,
                        },
                      ].map((x) => (
                        <div
                          key={x.label}
                          className="space-y-1 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3"
                        >
                          <p className="text-[0.75rem] font-semibold text-slate-900">
                            {x.label}
                          </p>
                          <Input
                            type="file"
                            accept="image/*,application/pdf"
                            className="h-8 cursor-pointer text-xs"
                            onChange={(e) => x.set(e.target.files?.[0] ?? null)}
                          />
                          {x.file && (
                            <p className="text-[0.65rem] text-muted-foreground">
                              {x.file.name}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <label className="flex items-center gap-2 text-[0.7rem]">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={sanitaryApplicable}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setSanitaryApplicable(on);
                            if (!on) setSanitaryPermitFile(null);
                          }}
                        />
                        Sanitary Permit is applicable for my dorm
                      </label>
                      <div className="mt-2 space-y-1">
                        <p className="text-[0.75rem] font-semibold text-slate-900">
                          Sanitary Permit{" "}
                          <span className="text-slate-500 font-normal">
                            (if applicable)
                          </span>
                        </p>
                        <Input
                          type="file"
                          accept="image/*,application/pdf"
                          className="h-8 cursor-pointer text-xs"
                          disabled={!sanitaryApplicable}
                          onChange={(e) =>
                            setSanitaryPermitFile(e.target.files?.[0] ?? null)
                          }
                        />
                        {sanitaryPermitFile && (
                          <p className="text-[0.65rem] text-muted-foreground">
                            {sanitaryPermitFile.name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                      <p className="text-[0.75rem] font-semibold text-slate-900">
                        Other supporting documents{" "}
                        <span className="text-slate-500 font-normal">
                          (optional: lease contract, photos, etc.)
                        </span>
                      </p>
                      <Input
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        className="h-8 cursor-pointer text-xs"
                        onChange={(e) =>
                          setSupportingDocFiles(Array.from(e.target.files ?? []))
                        }
                      />
                      {supportingDocFiles.length > 0 && (
                        <ul className="mt-1 list-disc pl-4 text-[0.65rem] text-slate-700">
                          {supportingDocFiles.map((file) => (
                            <li key={`${file.name}-${file.size}`}>{file.name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={goBack}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={goNext}
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
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={goBack}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={goNext}
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
                      Signature (upload):
                    </span>
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      className="h-8 cursor-pointer text-xs"
                      onChange={(e) => setSignatureFile(e.target.files?.[0] ?? null)}
                    />
                    {signatureFile && (
                      <div className="md:col-start-2 text-[0.65rem] text-muted-foreground">
                        {signatureFile.name}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between gap-2 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={goBack}
                    >
                      Back
                    </Button>
                    <div className="flex items-center gap-2">
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
                        disabled={submitting}
                        onClick={async () => {
                          const errs = validateWizardStep(5);
                          if (errs.length > 0) {
                            setWizardErrors(errs);
                            return;
                          }
                          setWizardErrors([]);
                          const address = [dormAddress.trim(), dormCity.trim()]
                            .filter(Boolean)
                            .join(", ");
                          setSubmitting(true);
                          try {
                            const [
                              ownerIdFrontUrl,
                              ownerIdBackUrl,
                              businessPermitUrl,
                              barangayClearanceUrl,
                              fireSafetyCertificateUrl,
                              occupancyPermitUrl,
                              sanitaryPermitUrl,
                              signatureUrl,
                              supportingUrls,
                            ] = await (async () => {
                              const idFront = await uploadDormConnectFile(
                                ownerIdFrontFile!
                              );
                              const idBack = await uploadDormConnectFile(
                                ownerIdBackFile!
                              );
                              const bp = await uploadDormConnectFile(
                                businessPermitFile!
                              );
                              const bc = await uploadDormConnectFile(
                                barangayClearanceFile!
                              );
                              const fs = await uploadDormConnectFile(
                                fireSafetyCertFile!
                              );
                              const op = await uploadDormConnectFile(
                                occupancyPermitFile!
                              );
                              const sp = sanitaryApplicable
                                ? await uploadDormConnectFile(sanitaryPermitFile!)
                                : undefined;
                              const sig = await uploadDormConnectFile(signatureFile!);
                              const supporting =
                                supportingDocFiles.length > 0
                                  ? await uploadDormConnectFiles(supportingDocFiles)
                                  : [];
                              return [
                                idFront,
                                idBack,
                                bp,
                                bc,
                                fs,
                                op,
                                sp,
                                sig,
                                supporting,
                              ] as const;
                            })();

                            const allAttachmentUrls = [
                              ownerIdFrontUrl,
                              ownerIdBackUrl,
                              businessPermitUrl,
                              barangayClearanceUrl,
                              fireSafetyCertificateUrl,
                              occupancyPermitUrl,
                              ...(sanitaryPermitUrl ? [sanitaryPermitUrl] : []),
                              signatureUrl,
                              ...supportingUrls,
                            ];

                            const res = await fetch("/api/landlord/accreditation", {
                              method: "POST",
                              credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                dormName: dormName.trim(),
                                address,
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
                                  documents: {
                                    businessPermit: {
                                      fileName: businessPermitFile?.name,
                                      url: businessPermitUrl,
                                    },
                                    barangayClearance: {
                                      fileName: barangayClearanceFile?.name,
                                      url: barangayClearanceUrl,
                                    },
                                    fireSafetyCertificate: {
                                      fileName: fireSafetyCertFile?.name,
                                      url: fireSafetyCertificateUrl,
                                    },
                                    occupancyPermit: {
                                      fileName: occupancyPermitFile?.name,
                                      url: occupancyPermitUrl,
                                    },
                                    sanitaryPermit: sanitaryApplicable
                                      ? {
                                          fileName: sanitaryPermitFile?.name,
                                          url: sanitaryPermitUrl,
                                        }
                                      : undefined,
                                    supporting: {
                                      fileNames: supportingDocFiles.map((f) => f.name),
                                      urls: supportingUrls,
                                    },
                                    signature: {
                                      fileName: signatureFile?.name,
                                      url: signatureUrl,
                                    },
                                  },
                                  // Back-compat convenience array for previews
                                  attachmentUrls: allAttachmentUrls,
                                  safety: {
                                    exits: safetyExits,
                                    extinguishers: safetyExtinguishers,
                                    contacts: safetyContacts,
                                    rooms: safetyRooms,
                                  },
                                  declaration: {
                                    name: declName,
                                  },
                                },
                              }),
                            });
                            const j = (await res.json()) as { error?: string };
                            if (!res.ok) throw new Error(j.error ?? "Failed");
                            setShowWizard(false);
                            setOwnerIdFrontFile(null);
                            setOwnerIdBackFile(null);
                            setBusinessPermitFile(null);
                            setBarangayClearanceFile(null);
                            setFireSafetyCertFile(null);
                            setOccupancyPermitFile(null);
                            setSanitaryApplicable(false);
                            setSanitaryPermitFile(null);
                            setSupportingDocFiles([]);
                            setSignatureFile(null);
                            setWizardErrors([]);
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accreditation request view details dialog */}
      {showDetailsDialog && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
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
                {detailsLoading ? (
                  <p className="text-[0.7rem] text-muted-foreground">
                    Loading uploaded documents…
                  </p>
                ) : collectFormAttachmentUrls(detailsFormData).length === 0 ? (
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

