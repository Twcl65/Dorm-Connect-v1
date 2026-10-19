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
import {
  isWithinAccreditationRenewalWindow,
  effectiveAccreditationExpiry,
} from "@/lib/accreditation-eligibility";
import { FilePlus2, Eye, Loader2, Printer, RefreshCw } from "lucide-react";

const ROWS_PER_PAGE = 5;

type AccreditationRow = {
  id: string;
  dormName: string;
  address: string;
  documentsCount: number;
  submittedDate: string;
  status: string;
  propertyId: string | null;
  expiresAt: string | null;
  inspectionScheduledFor: string | null;
  inspectionScheduleProposal: InspectionScheduleProposal | null;
};

function StatusBadge({ status }: { status: string }) {
  const colorClasses =
    status === "Approved"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Rejected"
        ? "bg-red-100 text-red-800"
        : status === "Expired"
          ? "bg-slate-200 text-slate-800"
          : status === "Pending"
            ? "bg-slate-100 text-slate-800"
            : status === "Scheduled for Inspection"
              ? "bg-sky-100 text-sky-800"
              : status === "Recommended for Approval"
                ? "bg-emerald-50 text-emerald-900"
                : status === "Hold"
                  ? "bg-amber-100 text-amber-900"
                  : "bg-slate-100 text-slate-700";

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

type Property = {
  id: string;
  name: string;
  address: string;
  city: string;
  contactPhone: string;
  contactEmail: string;
  propertyType: string;
  operationalStatus: string;
  totalRooms: number | null;
  maxOccupancyCapacity: number | null;
};

type InspectionScheduleProposal = {
  proposedDate: string;
  status: string;
};

function readInspectionScheduleProposal(
  formData: unknown
): InspectionScheduleProposal | null {
  if (!formData || typeof formData !== "object") return null;
  const proposal = (formData as Record<string, unknown>)
    .inspection_schedule_proposal;
  if (!proposal || typeof proposal !== "object") return null;
  const value = proposal as Record<string, unknown>;
  if (typeof value.proposedDate !== "string" || typeof value.status !== "string") {
    return null;
  }
  return { proposedDate: value.proposedDate, status: value.status };
}

function readOsaHoldMessage(formData: unknown): string | null {
  if (!formData || typeof formData !== "object") return null;
  const remarks = (formData as Record<string, unknown>).osa_remarks;
  return typeof remarks === "string" && remarks.trim() ? remarks.trim() : null;
}

export default function LandlordDocumentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState<AccreditationRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  // Renewal mode: when set, the wizard pre-selects the associated property
  const [renewalForRequest, setRenewalForRequest] =
    useState<AccreditationRow | null>(null);

  // Properties list for dropdown (eligible for new accreditation only)
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [ineligiblePropertyCount, setIneligiblePropertyCount] = useState(0);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");

  // Step A – Dorm information
  const [dormName, setDormName] = useState("");
  const [dormAddress, setDormAddress] = useState("");
  const [dormCity, setDormCity] = useState("");
  const [dormType, setDormType] = useState("Cement");
  const [dormRooms, setDormRooms] = useState("");
  const [dormCapacity, setDormCapacity] = useState("");

  // Step B – Owner / landlord information
  const [ownerName, setOwnerName] = useState("");
  const [ownerBusinessName, setOwnerBusinessName] = useState("");
  const [ownerContact, setOwnerContact] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

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

  // Step D – Declaration
  const [declCertify, setDeclCertify] = useState(false);
  const [declUnderstandSubmit, setDeclUnderstandSubmit] = useState(false);
  const [declUnderstandRevoke, setDeclUnderstandRevoke] = useState(false);
  const [declUnderstandInspect, setDeclUnderstandInspect] = useState(false);
  const [wizardErrors, setWizardErrors] = useState<string[]>([]);
  const [selectedRequest, setSelectedRequest] =
    useState<AccreditationRow | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsFormData, setDetailsFormData] = useState<unknown>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [inspectionScheduleDate, setInspectionScheduleDate] = useState("");
  const [inspectionScheduleSaving, setInspectionScheduleSaving] = useState(false);
  const [inspectionScheduleError, setInspectionScheduleError] = useState<string | null>(null);
  const [showInspectionScheduleDialog, setShowInspectionScheduleDialog] = useState(false);

  const refreshDocs = useCallback(async () => {
    if (!selectedRequest) return;
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/landlord/accreditation/${selectedRequest.id}`, {
        credentials: "include",
      });
      const json = (await res.json()) as {
        documentsCount?: number;
        formData?: unknown;
      };
      if (res.ok && json.formData !== undefined) {
        setDetailsFormData(json.formData);
      }
    } catch {
      /* non-fatal */
    } finally {
      setDetailsLoading(false);
    }
  }, [selectedRequest]);

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

  const respondToInspectionSchedule = async (
    action: "approve" | "change"
  ) => {
    if (!selectedRequest) return;
    setInspectionScheduleSaving(true);
    setInspectionScheduleError(null);
    try {
      const res = await fetch(
        `/api/landlord/accreditation/${selectedRequest.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inspectionScheduleAction: action,
            inspectionScheduleDate,
          }),
        }
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to confirm inspection date.");
      setShowInspectionScheduleDialog(false);
      await loadData();
    } catch (e) {
      setInspectionScheduleError(
        e instanceof Error ? e.message : "Failed to confirm inspection date."
      );
    } finally {
      setInspectionScheduleSaving(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load properties when wizard opens
  useEffect(() => {
    if (!showWizard) return;
    setPropertiesLoading(true);
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          "/api/landlord/properties?forAccreditation=true",
          { credentials: "include" }
        );
        const json = (await res.json()) as {
          properties?: Property[];
          ineligibleCount?: number;
          error?: string;
        };
        if (!cancelled && res.ok) {
          let eligible = json.properties ?? [];
          setProperties(eligible);
          setIneligiblePropertyCount(json.ineligibleCount ?? 0);
          // In renewal mode, pre-load the property's existing DORM data so
          // the landlord only needs to upload updated documents (#9).
          if (renewalForRequest && renewalForRequest.propertyId) {
            const prop = eligible.find((p) => p.id === renewalForRequest.propertyId);
            if (prop) {
              setDormName(prop.name);
              setDormAddress(prop.address ?? "");
              setDormCity(prop.city ?? "");
              setDormType("Cement");
              setDormRooms(
                prop.totalRooms != null ? String(prop.totalRooms) : ""
              );
              setDormCapacity(
                prop.maxOccupancyCapacity != null
                  ? String(prop.maxOccupancyCapacity)
                  : ""
              );
            } else {
              // Property may be ineligible list – include it for renewal
              eligible = [
                ...eligible,
                ...(json.properties ?? []),
              ];
              const fallback = (json.properties ?? []).find(
                (p) => p.id === renewalForRequest.propertyId
              );
              if (fallback) {
                setDormName(fallback.name);
                setDormAddress(fallback.address ?? "");
                setDormCity(fallback.city ?? "");
                setDormType("Cement");
                setDormRooms(
                  fallback.totalRooms != null
                    ? String(fallback.totalRooms)
                    : ""
                );
                setDormCapacity(
                  fallback.maxOccupancyCapacity != null
                    ? String(fallback.maxOccupancyCapacity)
                    : ""
                );
              }
            }
            setSelectedPropertyId(renewalForRequest.propertyId ?? "");
          } else {
            setSelectedPropertyId((current) =>
              eligible.some((p) => p.id === current) ? current : ""
            );
          }
        }
      } catch {
        if (!cancelled) {
          setProperties([]);
          setIneligiblePropertyCount(0);
        }
      } finally {
        if (!cancelled) setPropertiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showWizard]);

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
        if (!cancelled && res.ok) {
          const formData = j.formData ?? null;
          setDetailsFormData(formData);
          const proposal = readInspectionScheduleProposal(formData);
          setInspectionScheduleDate(proposal?.proposedDate ?? "");
          setInspectionScheduleError(null);
        }
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
    (step: 1 | 2 | 3 | 4): string[] => {
      const errors: string[] = [];
      if (step === 1) {
        if (!ownerName.trim()) errors.push("Owner full name is required.");
        if (!ownerBusinessName.trim())
          errors.push("Business name is required.");
        if (!ownerContact.trim()) errors.push("Owner contact number is required.");
        if (!ownerEmail.trim()) errors.push("Owner email address is required.");
      }
      if (step === 2) {
        if (!selectedPropertyId.trim())
          errors.push("Please select a dorm from your properties.");
        if (!dormAddress.trim()) errors.push("Dorm address is required.");
        if (!dormCity.trim()) errors.push("City / municipality is required.");
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
        if (!declCertify)
          errors.push("You must certify that the information provided is accurate.");
        if (!declUnderstandSubmit)
          errors.push("Confirm you understand submission does not guarantee approval.");
        if (!declUnderstandRevoke)
          errors.push("Confirm you understand accreditation may be revoked.");
        if (!declUnderstandInspect)
          errors.push("Confirm you understand OSA may inspect the premises.");
      }
      return errors;
    },
    [
      selectedPropertyId,
      dormAddress,
      dormCity,
      ownerName,
      ownerBusinessName,
      ownerContact,
      ownerEmail,
      businessPermitFile,
      barangayClearanceFile,
      fireSafetyCertFile,
      occupancyPermitFile,
      sanitaryApplicable,
      sanitaryPermitFile,
      declCertify,
      declUnderstandSubmit,
      declUnderstandRevoke,
      declUnderstandInspect,
    ]
  );

  const wizardProgress = useMemo(() => {
    const checks = [
      Boolean(ownerName.trim()),
      Boolean(ownerBusinessName.trim()),
      Boolean(ownerContact.trim()),
      Boolean(ownerEmail.trim()),
      Boolean(selectedPropertyId.trim()),
      Boolean(dormAddress.trim()),
      Boolean(dormCity.trim()),
      Boolean(businessPermitFile),
      Boolean(barangayClearanceFile),
      Boolean(fireSafetyCertFile),
      Boolean(occupancyPermitFile),
      sanitaryApplicable ? Boolean(sanitaryPermitFile) : true,
      declCertify,
      declUnderstandSubmit,
      declUnderstandRevoke,
      declUnderstandInspect,
    ];
    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  }, [
    ownerName,
    ownerBusinessName,
    ownerContact,
    ownerEmail,
    selectedPropertyId,
    dormAddress,
    dormCity,
    businessPermitFile,
    barangayClearanceFile,
    fireSafetyCertFile,
    occupancyPermitFile,
    sanitaryApplicable,
    sanitaryPermitFile,
    declCertify,
    declUnderstandSubmit,
    declUnderstandRevoke,
    declUnderstandInspect,
  ]);

  const validateAllWizardSteps = useCallback((): string[] => {
    return ([1, 2, 3, 4] as const).flatMap((step) =>
      validateWizardStep(step)
    );
  }, [validateWizardStep]);

  const canRenew = (req: AccreditationRow): boolean => {
    if (req.status !== "Approved") return false;
    try {
      const expiresAt = req.expiresAt
        ? new Date(req.expiresAt)
        : effectiveAccreditationExpiry(req.submittedDate, null);
      if (isNaN(expiresAt.getTime())) return false;
      return isWithinAccreditationRenewalWindow(expiresAt);
    } catch {
      return false;
    }
  };

  const osaHoldMessage = readOsaHoldMessage(detailsFormData);

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
              setRenewalForRequest(null);
              setSelectedPropertyId("");
              setIneligiblePropertyCount(0);
              setDormName("");
              setDormAddress("");
              setDormCity("");
              setDormType("Cement");
              setDormRooms("");
              setDormCapacity("");
              setBusinessPermitFile(null);
              setBarangayClearanceFile(null);
              setFireSafetyCertFile(null);
              setOccupancyPermitFile(null);
              setSanitaryApplicable(false);
              setSanitaryPermitFile(null);
              setSupportingDocFiles([]);
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
                <TableHead>Dorm/Boarding House Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Submitted Date</TableHead>
                <TableHead>Inspection Date</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 font-semibold text-slate-600">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRequests.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
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
                  <TableCell className="text-xs text-slate-700">
                    {req.inspectionScheduleProposal?.status === "pending" ? (
                      <div className="flex flex-col items-start gap-1">
                        <span>
                          {new Date(`${req.inspectionScheduleProposal.proposedDate}T00:00:00`).toLocaleDateString()}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[0.7rem] border-sky-400 text-sky-700 hover:bg-sky-50"
                          onClick={() => {
                            setSelectedRequest(req);
                            setInspectionScheduleDate(
                              req.inspectionScheduleProposal?.proposedDate ?? ""
                            );
                            setInspectionScheduleError(null);
                            setShowInspectionScheduleDialog(true);
                          }}
                        >
                          Confirm
                        </Button>
                      </div>
                    ) : req.inspectionScheduledFor ? (
                      new Date(`${req.inspectionScheduledFor}T00:00:00`).toLocaleDateString()
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {req.expiresAt ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={req.status} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-center gap-2">
                      {req.status === "Approved" && canRenew(req) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-blue-400 text-blue-600 hover:bg-blue-50 hover:text-blue-600"
                          onClick={() => {
                            setRenewalForRequest(req);
                            setShowWizard(true);
                          }}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Renew
                        </Button>
                      )}
                      {req.status === "Approved" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-emerald-400 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-600"
                          onClick={() => {
                            window.location.href = `/landlord/documents/${req.id}/certificate`;
                          }}
                        >
                          <Printer className="h-3 w-3" />
                          View Certificate
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                        onClick={() => {
                          setSelectedRequest(req);
                          setDetailsFormData(null);
                          setDetailsLoading(true);
                          void refreshDocs();
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
            <CardHeader className="sticky top-0 z-10 border-b bg-white pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  {renewalForRequest ? "Renew Accreditation" : "Apply For Accreditation"}
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => {
                    setShowWizard(false);
                    setRenewalForRequest(null);
                  }}
                >
                  Close
                </Button>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-[0.7rem] text-slate-600">
                  <span>Application progress</span>
                  <span className="font-semibold text-slate-900">
                    {wizardProgress}%
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-valuenow={wizardProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${wizardProgress}%` }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-8rem)] space-y-6 overflow-y-auto pt-4 text-xs text-slate-800">
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
                <div className="space-y-3 border-b border-slate-200 pb-6">
                  <p className="text-[0.8rem] font-semibold text-slate-900">
                    A. Owner / Landlord Information
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
                </div>

                <div className="space-y-3 border-b border-slate-200 pb-6">
                  <p className="text-[0.8rem] font-semibold text-slate-900">
                    B. Dorm Information
                  </p>
                  <div className="grid gap-2 md:grid-cols-[140px,1fr] items-center">
                    <span className="text-[0.7rem] text-slate-700">
                      Dorm/Boarding House Name:
                    </span>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => {
                        const propId = e.target.value;
                        setSelectedPropertyId(propId);
                        const prop = properties.find((p) => p.id === propId);
                        if (prop) {
                          setDormName(prop.name);
                          setDormAddress(prop.address ?? "");
                          setDormCity(prop.city ?? "");
                          setDormType(prop.propertyType === "Cement" ? "Cement" : prop.propertyType === "Wood" ? "Wood" : prop.propertyType === "Hybrid" ? "Hybrid" : "Cement");
                          setDormRooms(
                            prop.totalRooms != null
                              ? String(prop.totalRooms)
                              : ""
                          );
                          setDormCapacity(
                            prop.maxOccupancyCapacity != null
                              ? String(prop.maxOccupancyCapacity)
                              : ""
                          );
                        } else {
                          setDormName("");
                          setDormAddress("");
                          setDormCity("");
                          setDormType("Cement");
                          setDormRooms("");
                          setDormCapacity("");
                        }
                      }}
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                      disabled={propertiesLoading}
                    >
                      <option value="">
                        {propertiesLoading
                          ? "Loading properties…"
                          : properties.length === 0
                            ? ineligiblePropertyCount > 0
                              ? "No dorms available — approved until renewal window"
                              : "No properties — add one in Rooms Management first"
                            : "Select a dorm…"}
                      </option>
                      {properties.map((prop) => (
                        <option key={prop.id} value={prop.id}>
                          {prop.name}
                        </option>
                      ))}
                    </select>
                    {!propertiesLoading && ineligiblePropertyCount > 0 && (
                      <p className="md:col-span-2 text-[0.65rem] text-muted-foreground">
                        {ineligiblePropertyCount === 1
                          ? "1 property is hidden"
                          : `${ineligiblePropertyCount} properties are hidden`}{" "}
                        (active application or approved accreditation). Approved
                        dorms can apply again within 3 months of expiry.
                      </p>
                    )}
                    <span className="text-[0.7rem] text-slate-700">
                      Dorm Address:
                    </span>
                    <Input
                      value={dormAddress}
                      className="h-8 text-xs bg-slate-100"
                      readOnly
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      City / Municipality:
                    </span>
                    <Input
                      value={dormCity}
                      className="h-8 text-xs bg-slate-100"
                      readOnly
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      Establishment Type:
                    </span>
                    <select
                      className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                      value={dormType}
                      onChange={(e) => setDormType(e.target.value)}
                    >
                      <option value="Cement">Cement</option>
                      <option value="Wood">Wood</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                    <span className="text-[0.7rem] text-slate-700">
                      Number of Rooms:
                    </span>
                    <Input
                      value={dormRooms || "—"}
                      className="h-8 text-xs bg-slate-100"
                      readOnly
                    />
                    <span className="text-[0.7rem] text-slate-700">
                      Total Capacity:
                    </span>
                    <Input
                      value={dormCapacity || "—"}
                      className="h-8 text-xs bg-slate-100"
                      readOnly
                    />
                  </div>
                </div>

                <div className="space-y-3 border-b border-slate-200 pb-6">
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
                            accept="image/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
                          accept="image/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
                        accept="image/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
                </div>

                <div className="space-y-3">
                  <p className="text-[0.8rem] font-semibold text-slate-900">
                    D. Declaration
                  </p>
                  <div className="space-y-2 text-[0.7rem] text-slate-800">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3 w-3 shrink-0"
                        checked={declCertify}
                        onChange={(e) => setDeclCertify(e.target.checked)}
                      />
                      <span>
                        I hereby certify that all information provided in this
                        application is true, complete, and accurate to the best
                        of my knowledge.
                      </span>
                    </label>
                    <p className="pl-5 font-medium text-slate-900">
                      I understand that:
                    </p>
                    <label className="flex items-start gap-2 pl-5">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3 w-3 shrink-0"
                        checked={declUnderstandSubmit}
                        onChange={(e) =>
                          setDeclUnderstandSubmit(e.target.checked)
                        }
                      />
                      <span>Submission does not guarantee approval.</span>
                    </label>
                    <label className="flex items-start gap-2 pl-5">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3 w-3 shrink-0"
                        checked={declUnderstandRevoke}
                        onChange={(e) =>
                          setDeclUnderstandRevoke(e.target.checked)
                        }
                      />
                      <span>
                        Accreditation may be revoked if compliance is violated.
                      </span>
                    </label>
                    <label className="flex items-start gap-2 pl-5">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3 w-3 shrink-0"
                        checked={declUnderstandInspect}
                        onChange={(e) =>
                          setDeclUnderstandInspect(e.target.checked)
                        }
                      />
                      <span>OSA reserves the right to inspect the premises.</span>
                    </label>
                  </div>
                  <p className="text-[0.7rem] text-slate-500">
                    The applicant name is taken from your account profile.
                  </p>
                  <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => {
                        setShowWizard(false);
                        setRenewalForRequest(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      disabled={submitting}
                      onClick={async () => {
                          const errs = validateAllWizardSteps();
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
                              businessPermitUrl,
                              barangayClearanceUrl,
                              fireSafetyCertificateUrl,
                              occupancyPermitUrl,
                              sanitaryPermitUrl,
                              supportingUrls,
                            ] = await (async () => {
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
                              const supporting =
                                supportingDocFiles.length > 0
                                  ? await uploadDormConnectFiles(supportingDocFiles)
                                  : [];
                              return [bp, bc, fs, op, sp, supporting] as const;
                            })();

                            const allAttachmentUrls = [
                              businessPermitUrl,
                              barangayClearanceUrl,
                              fireSafetyCertificateUrl,
                              occupancyPermitUrl,
                              ...(sanitaryPermitUrl ? [sanitaryPermitUrl] : []),
                              ...supportingUrls,
                            ];

                            const res = await fetch("/api/landlord/accreditation", {
                              method: "POST",
                              credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                propertyId: selectedPropertyId,
                                dormName: dormName.trim(),
                                address,
                                formData: {
                                  dorm: {
                                    name: dormName,
                                    address: dormAddress,
                                    city: dormCity,
                                    type: dormType,
                                    rooms: dormRooms,
                                    capacity: dormCapacity,
                                  },
                                  owner: {
                                    name: ownerName,
                                    businessName: ownerBusinessName,
                                    contact: ownerContact,
                                    email: ownerEmail,
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
                                  },
                                  // Back-compat convenience array for previews
                                  attachmentUrls: allAttachmentUrls,
                                  declaration: {
                                    checklist: {
                                      certify: declCertify,
                                      understandSubmit: declUnderstandSubmit,
                                      understandRevoke: declUnderstandRevoke,
                                      understandInspect: declUnderstandInspect,
                                    },
                                  },
                                },
                              }),
                            });
                            const j = (await res.json()) as { error?: string };
                            if (!res.ok) throw new Error(j.error ?? "Failed");
                            setShowWizard(false);
                            setRenewalForRequest(null);
                            setBusinessPermitFile(null);
                            setBarangayClearanceFile(null);
                            setFireSafetyCertFile(null);
                            setOccupancyPermitFile(null);
                            setSanitaryApplicable(false);
                            setSanitaryPermitFile(null);
                            setSupportingDocFiles([]);
                            setWizardErrors([]);
                            await loadData();
                          } catch (e) {
                            const msg =
                              e instanceof Error ? e.message : "Submit failed";
                            setWizardErrors([msg]);
                            setLoadError(msg);
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                      >
                        {submitting ? "Submitting…" : "Submit"}
                      </Button>
                  </div>
                </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showInspectionScheduleDialog &&
        selectedRequest?.inspectionScheduleProposal?.status === "pending" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-6">
            <Card className="w-full max-w-md border border-gray-300 bg-white">
              <CardHeader className="pb-2 border-b bg-muted/40">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Confirm inspection schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-3 text-xs text-slate-800">
                <p>
                  OSA proposed an inspection for{" "}
                  <span className="font-semibold">{selectedRequest.dormName}</span>{" "}
                  on{" "}
                  <span className="font-semibold">
                    {new Date(
                      `${selectedRequest.inspectionScheduleProposal.proposedDate}T00:00:00`
                    ).toLocaleDateString()}
                  </span>.
                </p>
                <label className="block space-y-1 font-medium text-slate-700">
                  Choose a different date if needed
                  <Input
                    type="date"
                    className="h-9 text-xs"
                    value={inspectionScheduleDate}
                    onChange={(e) => setInspectionScheduleDate(e.target.value)}
                  />
                </label>
                {inspectionScheduleError && (
                  <p className="text-xs text-red-700">{inspectionScheduleError}</p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={inspectionScheduleSaving}
                    onClick={() => setShowInspectionScheduleDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={inspectionScheduleSaving}
                    onClick={() => void respondToInspectionSchedule("approve")}
                  >
                    Approve proposed date
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={!inspectionScheduleDate || inspectionScheduleSaving}
                    onClick={() => void respondToInspectionSchedule("change")}
                  >
                    {inspectionScheduleSaving ? "Confirming…" : "Confirm chosen date"}
                  </Button>
                </div>
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

              {selectedRequest.status === "Hold" && !detailsLoading && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-900">
                    Message from OSA
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-amber-900">
                    {osaHoldMessage ?? "OSA placed this request on hold without an additional message."}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Uploaded files
                  {selectedRequest.status === "Hold" && (
                    <span className="ml-1 text-[0.65rem] font-normal text-muted-foreground">
                      (add missing/updated proof)
                    </span>
                  )}
                </p>
                                                {/* Show uploaded documents first, then upload area for Hold */}
                                                                {detailsFormData
                                                                  ? (() => {
                                                                      const docs = (detailsFormData as unknown as { documents: Array<{ fileUrl?: string; url?: string }> }).documents;
                                                                      if (!Array.isArray(docs)) return null;
                                                                      return docs.map((doc: any, i: number) => {
                                                                        const d = doc as { fileUrl?: string; url?: string };
                                                                        const url = d.fileUrl || d.url;
                                                                        if (!url) return null;
                                                                        return (
                                                                          <div
                                                                            key={url || i}
                                                                            className="rounded-md border border-slate-200 bg-slate-50 p-2"
                                                                          >
                                                                            <ProofMedia
                                                                              url={url}
                                                                              className="max-h-40 w-full rounded object-contain"
                                                                            />
                                                                          </div>
                                                                        );
                                                                      });
                                                                    })()
                                                                  : null}
                {selectedRequest.status === "Hold" ? (
                  <div className="mt-3 space-y-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                    <Input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="h-8 cursor-pointer text-xs"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length === 0) return;
                        try {
                          const urls = await uploadDormConnectFiles(files);
                          const documents = files.map((file, index) => ({
                            mimeType: file.type,
                            fileName: file.name,
                            fileUrl: urls[index],
                          }));
                          const res = await fetch(
                            `/api/landlord/accreditation/${selectedRequest.id}`,
                            {
                              method: "PATCH",
                              credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ documents }),
                            }
                          );
                          const j = (await res.json()) as {
                            error?: string;
                            documentsCount?: number;
                          };
                          if (!res.ok) {
                            alert(j.error ?? "Failed to add documents.");
                          } else {
                            const documentsCount =
                              j.documentsCount ??
                              selectedRequest.documentsCount + documents.length;
                            setDetailsFormData((prev: unknown) => {
                              const current =
                                prev && typeof prev === "object"
                                  ? (prev as Record<string, unknown>)
                                  : {};
                              const previousUrls = Array.isArray(current.attachmentUrls)
                                ? current.attachmentUrls.filter(
                                    (url): url is string => typeof url === "string"
                                  )
                                : [];
                              return {
                                ...current,
                                additional_documents: [
                                  ...(Array.isArray(current.additional_documents)
                                    ? current.additional_documents
                                    : []),
                                  ...documents,
                                ],
                                attachmentUrls: [...previousUrls, ...urls],
                              };
                            });
                            setSelectedRequest((current) =>
                              current
                                ? { ...current, status: "Pending", documentsCount }
                                : current
                            );
                            setRequests((current) =>
                              current.map((request) =>
                                request.id === selectedRequest.id
                                  ? { ...request, status: "Pending", documentsCount }
                                  : request
                              )
                            );
                            setLoadError(null);
                          }
                        } catch (err) {
                          setLoadError(
                            err instanceof Error ? err.message : "Upload failed"
                          );
                        }
                        e.target.value = "";
                      }}
                    />
                    <p className="text-[0.65rem] text-muted-foreground">
                      Upload additional proof (e.g., updated floor plan, new photos,
                      or permits). The request returns to Pending for OSA review.
                    </p>
                  </div>
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
                {selectedRequest.status === "Hold" && (
                  <p className="text-[0.65rem] text-muted-foreground">
                    Resubmitted files appear below with a reissue marker.
                  </p>
                )}
              </div>

              {selectedRequest.status !== "Hold" && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[0.7rem] text-slate-700">
                  <p>
                    OSA staff can review the same attachments from their
                    accreditation tools. To change data after submission, contact
                    OSA or submit a new application if allowed.
                  </p>
                </div>
              )}

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

