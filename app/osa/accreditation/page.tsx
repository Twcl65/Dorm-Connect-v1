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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Edit3, Eye, Printer, Save, X, Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { ProofMedia } from "@/components/proof-media";
import { OSA_INSPECTION_CHECKLIST } from "@/lib/osa-inspection";

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

function collectSubmittedDocuments(
  formData: unknown
): { name: string; url: string }[] {
  const documents = new Map<string, string>();
  const humanize = (value: string) =>
    value
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const add = (url: string, name: string) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    if (!documents.has(trimmedUrl)) {
      documents.set(trimmedUrl, name.trim() || "Submitted document");
    }
  };
  if (!formData || typeof formData !== "object") return [];
  const root = formData as Record<string, unknown>;
  const owner = root.owner;
  if (owner && typeof owner === "object") {
    const ownerRecord = owner as Record<string, unknown>;
    if (typeof ownerRecord.ownerIdFrontUrl === "string") {
      add(ownerRecord.ownerIdFrontUrl, "Owner identification document (front)");
    }
    if (typeof ownerRecord.ownerIdBackUrl === "string") {
      add(ownerRecord.ownerIdBackUrl, "Owner identification document (back)");
    }
  }

  const submitted = root.documents;
  if (submitted && typeof submitted === "object") {
    const documentRecord = submitted as Record<string, unknown>;
    const labels: Record<string, string> = {
      businessPermit: "Business Permit",
      barangayClearance: "Barangay Clearance",
      fireSafetyCertificate: "Fire Safety Certificate",
      occupancyPermit: "Occupancy Permit",
      sanitaryPermit: "Sanitary Permit",
    };
    for (const [key, value] of Object.entries(documentRecord)) {
      if (!value || typeof value !== "object") continue;
      const entry = value as Record<string, unknown>;
      if (key === "supporting") {
        const urls = Array.isArray(entry.urls) ? entry.urls : [];
        const names = Array.isArray(entry.fileNames) ? entry.fileNames : [];
        urls.forEach((url, index) => {
          if (typeof url === "string") {
            const fileName = typeof names[index] === "string" ? names[index] : "";
            add(url, fileName ? `Supporting Document - ${fileName}` : `Supporting Document ${index + 1}`);
          }
        });
        continue;
      }
      const url =
        (typeof entry.url === "string" && entry.url) ||
        (typeof entry.fileUrl === "string" && entry.fileUrl);
      if (url) {
        const title = labels[key] ?? humanize(key);
        const fileName = typeof entry.fileName === "string" ? entry.fileName.trim() : "";
        add(url, fileName ? `${title} - ${fileName}` : title);
      }
    }
  }

  const additional = Array.isArray(root.additional_documents)
    ? root.additional_documents
    : [];
  additional.forEach((value, index) => {
    if (!value || typeof value !== "object") return;
    const entry = value as Record<string, unknown>;
    const url =
      (typeof entry.fileUrl === "string" && entry.fileUrl) ||
      (typeof entry.url === "string" && entry.url);
    if (!url) return;
    const fileName =
      (typeof entry.fileName === "string" && entry.fileName.trim()) ||
      `Additional Document ${index + 1}`;
    add(url, `Additional Document - ${fileName}`);
  });

  const allUrls = Array.isArray(root.attachmentUrls) ? root.attachmentUrls : [];
  allUrls.forEach((url, index) => {
    if (typeof url === "string" && !documents.has(url.trim())) {
      add(url, `Submitted Document ${index + 1}`);
    }
  });

  return Array.from(documents, ([url, name]) => ({ name, url }));
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
  inspectionScheduledFor?: string | null;
  inspectionScheduleProposal?: {
    proposedDate: string;
    status: string;
  } | null;
};

type DormitoryRoomInfo = {
  id: string;
  roomNumber: string;
  capacity: number;
  monthlyRate: string;
  status: string;
  remarks: string | null;
  location: string | null;
  description: string | null;
  backgroundImageUrl: string | null;
  listingImageUrls: string[];
  roomImageUrls: string[];
  sizeLabel: string | null;
  details: string | null;
};

type DormitoryInfo = {
  name: string;
  address: string;
  city: string | null;
  propertyType: string | null;
  description: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  totalRooms: number | null;
  maxOccupancyCapacity: number | null;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
  rooms: DormitoryRoomInfo[];
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
    status === "Pending"
      ? "bg-amber-100 text-amber-800"
      : status === "Scheduled for Inspection"
        ? "bg-sky-100 text-sky-800"
        : status === "Recommended for Approval"
          ? "bg-emerald-50 text-emerald-900"
          : status === "Hold"
            ? "bg-amber-100 text-amber-900"
            : status === "Rejected"
              ? "bg-red-100 text-red-800"
              : status === "Approved"
                ? "bg-emerald-100 text-emerald-800"
                : status === "Expired"
                  ? "bg-slate-200 text-slate-800"
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
  const [inspectionPdfSaving, setInspectionPdfSaving] = useState(false);
  const [inspectionPdfError, setInspectionPdfError] = useState<string | null>(null);

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
  const [showStaffInspectionResultDialog, setShowStaffInspectionResultDialog] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showNeedsDocsDialog, setShowNeedsDocsDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [needsDocsNote, setNeedsDocsNote] = useState("");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [inspectionDate, setInspectionDate] = useState("");
  const [showInspectionResultDialog, setShowInspectionResultDialog] =
    useState(false);
  const [inspectionResult, setInspectionResult] = useState(
    "Recommended for Approval"
  );
  const [inspectionNotes, setInspectionNotes] = useState("");

  const [selectedDorm, setSelectedDorm] = useState<OsaAccreditedRow | null>(
    null
  );
  const [showDormReviewDialog, setShowDormReviewDialog] = useState(false);

  const [requestDetailFormData, setRequestDetailFormData] = useState<
    unknown | null
  >(null);
  const [requestDetailLoading, setRequestDetailLoading] = useState(false);
  const [requestDormitoryInfo, setRequestDormitoryInfo] =
    useState<DormitoryInfo | null>(null);
  const [showDormitoryInfoDialog, setShowDormitoryInfoDialog] = useState(false);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState<number | null>(null);

  const [signatoryConfig, setSignatoryConfig] = useState<{
    signatory_name: string;
    signatory_title: string;
    campus: string;
    campus_director_name: string;
  } | null>(null);
  const [signatoryLoading, setSignatoryLoading] = useState(true);
  const [signatorySaving, setSignatorySaving] = useState(false);
  const [signatorySaveError, setSignatorySaveError] = useState<string | null>(null);

  const [showSignatoryDialog, setShowSignatoryDialog] = useState(false);
  const [editSignatoryName, setEditSignatoryName] = useState("OSA Authorized Representative");
  const [editSignatoryTitle, setEditSignatoryTitle] = useState("Office of Student Affairs");
  const [editCampus, setEditCampus] = useState("USTP Jasaan Campus");
  const [editCampusDirectorName, setEditCampusDirectorName] = useState("Campus Director");

  const [showTermsDialog, setShowTermsDialog] = useState(false);

  const requestAttachmentUrls = useMemo(
    () => collectFormAttachmentUrls(requestDetailFormData),
    [requestDetailFormData]
  );
  const submittedDocuments = useMemo(
    () => collectSubmittedDocuments(requestDetailFormData),
    [requestDetailFormData]
  );
  const requestInspectionFormData =
    requestDetailFormData && typeof requestDetailFormData === "object"
      ? (requestDetailFormData as Record<string, unknown>)
      : {};
  const savedInspectionChecklist =
    requestInspectionFormData.inspection_checklist &&
    typeof requestInspectionFormData.inspection_checklist === "object"
      ? (requestInspectionFormData.inspection_checklist as Record<string, boolean>)
      : {};
  const savedInspectionNotes =
    typeof requestInspectionFormData.inspection_notes === "string"
      ? requestInspectionFormData.inspection_notes
      : "";
  const savedInspectionPreparedBy =
    typeof requestInspectionFormData.inspection_prepared_by === "string"
      ? requestInspectionFormData.inspection_prepared_by.trim()
      : "";
  const savedInspectionPreparedByRole =
    typeof requestInspectionFormData.inspection_prepared_by_role === "string"
      ? requestInspectionFormData.inspection_prepared_by_role.trim()
      : "Staff";
  const selectedAttachmentUrl =
    selectedAttachmentIndex === null
      ? null
      : requestAttachmentUrls[selectedAttachmentIndex] ?? null;
  const selectedAttachmentPath = selectedAttachmentUrl?.split("?")[0] ?? "";
  const selectedAttachmentName = decodeURIComponent(
    selectedAttachmentPath.split("/").pop() || "Submitted document"
  );
  const selectedAttachmentIsPdf = selectedAttachmentPath.toLowerCase().endsWith(".pdf");
  const selectedAttachmentIsWord = /\.(doc|docx)$/i.test(selectedAttachmentPath);

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

  const loadSignatoryConfig = useCallback(async () => {
    setSignatoryLoading(true);
    try {
      const res = await fetch("/api/osa/settings", { credentials: "include" });
      const json = (await res.json()) as {
        config?: {
          signatory_name: string;
          signatory_title: string;
          campus: string;
          campus_director_name: string;
        };
        error?: string;
      };
      if (!res.ok) {
        setSignatoryConfig(null);
        return;
      }
      setSignatoryConfig(json.config ?? null);
    } catch {
      setSignatoryConfig(null);
    } finally {
      setSignatoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSignatoryConfig();
  }, [loadSignatoryConfig]);

  const saveSignatoryConfig = async () => {
    const defaults = {
      signatory_name: "OSA Authorized Representative",
      signatory_title: "Office of Student Affairs",
      campus: "USTP Jasaan Campus",
      campus_director_name: "Campus Director",
    };
    const toSave = {
      signatory_name: editSignatoryName.trim() || defaults.signatory_name,
      signatory_title: editSignatoryTitle.trim() || defaults.signatory_title,
      campus: editCampus.trim() || defaults.campus,
      campus_director_name: editCampusDirectorName.trim() || defaults.campus_director_name,
    };
    setSignatorySaving(true);
    setSignatorySaveError(null);
    try {
      const res = await fetch("/api/osa/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(j.error ?? "Failed to save");
      setSignatoryConfig(toSave);
      setShowSignatoryDialog(false);
    } catch (e) {
      setSignatorySaveError(
        e instanceof Error ? e.message : "Failed to save signatory settings."
      );
    } finally {
      setSignatorySaving(false);
    }
  };

  const downloadInspectionResultPdf = async () => {
    if (!selectedRequest) return;
    setInspectionPdfSaving(true);
    setInspectionPdfError(null);
    try {
      const { default: JsPDF } = await import("jspdf");
      const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const margin = 16;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - margin * 2;
      const bottomLimit = pageHeight - 18;
      let y = 49;

      const addContinuationPage = () => {
        pdf.addPage();
        pdf.setFillColor(16, 43, 66);
        pdf.rect(0, 0, pageWidth, 13, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text("INSPECTION RESULT REPORT", margin, 8.5);
        pdf.setDrawColor(210, 220, 228);
        pdf.line(margin, 17, pageWidth - margin, 17);
        pdf.setTextColor(35, 45, 55);
        y = 24;
      };

      const ensureSpace = (height: number) => {
        if (y + height > bottomLimit) addContinuationPage();
      };

      const writeText = (
        text: string,
        options: { bold?: boolean; fontSize?: number; indent?: number } = {}
      ) => {
        const { bold = false, fontSize = 10, indent = 0 } = options;
        pdf.setFont("helvetica", bold ? "bold" : "normal");
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(text || " ", contentWidth - indent) as string[];
        const lineHeight = fontSize * 0.36 + 1.1;
        for (const line of lines) {
          ensureSpace(lineHeight + 1);
          pdf.text(line, margin + indent, y);
          y += lineHeight;
        }
        y += 1.5;
      };

      const writeSection = (title: string) => {
        ensureSpace(12);
        pdf.setFillColor(235, 242, 247);
        pdf.roundedRect(margin, y, contentWidth, 8, 1, 1, "F");
        pdf.setTextColor(16, 43, 66);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(title, margin + 3, y + 5.4);
        y += 11;
      };

      pdf.setFillColor(16, 43, 66);
      pdf.rect(0, 0, pageWidth, 39, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(17);
      pdf.text("INSPECTION RESULT REPORT", pageWidth / 2, 17, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("Dormitory Accreditation", pageWidth / 2, 24, { align: "center" });
      pdf.setTextColor(220, 230, 238);
      pdf.text(`Generated ${new Date().toLocaleDateString()}`, pageWidth / 2, 31, { align: "center" });
      pdf.setTextColor(35, 45, 55);

      writeSection("Dormitory details");
      writeText(`Dormitory: ${selectedRequest.dormName}`, { bold: true });
      writeText(`Landlord: ${selectedRequest.owner}`);
      writeText(`Address: ${selectedRequest.address || "Not provided"}`);
      writeText(`Request ID: ${selectedRequest.id}`, { fontSize: 9 });
      writeText(`Inspection date: ${selectedRequest.inspectionScheduledFor || "Not recorded"}`);

      writeSection("Inspection result");
      writeText("Recommended for Approval", { bold: true, fontSize: 11, indent: 2 });

      writeSection("Completed checklist");
      for (const item of OSA_INSPECTION_CHECKLIST) {
        const checked = savedInspectionChecklist[item.key] === true;
        writeText(`[${checked ? "X" : " "}] ${item.label} - ${checked ? "Checked" : "Not checked"}`, { indent: 2 });
      }

      writeSection("Documents submitted by the dormitory");
      if (submittedDocuments.length === 0) {
        writeText("No uploaded documents were found for this request.");
      } else {
        submittedDocuments.forEach((document, index) => {
          writeText(`${index + 1}. ${document.name}`, { indent: 2 });
        });
      }

      writeSection("Remarks");
      writeText(savedInspectionNotes || "No inspection remarks were recorded.");

      const { appendDocumentsAndPreparedBy } = await import(
        "@/lib/inspection-result-pdf"
      );
      const combinedPdf = await appendDocumentsAndPreparedBy(
        new Uint8Array(pdf.output("arraybuffer")),
        submittedDocuments,
        savedInspectionPreparedBy,
        savedInspectionPreparedByRole
      );

      const safeName = selectedRequest.dormName
        .trim()
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "");
      const fileName = `Inspection_Result_${safeName || "Dormitory"}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const pdfBuffer = new ArrayBuffer(combinedPdf.byteLength);
      new Uint8Array(pdfBuffer).set(combinedPdf);
      const fileUrl = URL.createObjectURL(
        new Blob([pdfBuffer], { type: "application/pdf" })
      );
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
    } catch (e) {
      setInspectionPdfError(
        e instanceof Error ? e.message : "Failed to generate inspection PDF."
      );
    } finally {
      setInspectionPdfSaving(false);
    }
  };

  useEffect(() => {
    if (
      (!showRequestDialog && !showDormitoryInfoDialog && !showStaffInspectionResultDialog && selectedAttachmentIndex === null) ||
      !selectedRequest?.id
    ) {
      setRequestDetailFormData(null);
      setRequestDormitoryInfo(null);
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
          dormitoryInfo?: DormitoryInfo;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setRequestDetailFormData(null);
          return;
        }
        setRequestDetailFormData(json.formData ?? null);
        setRequestDormitoryInfo(json.dormitoryInfo ?? null);
      } catch {
        if (!cancelled) {
          setRequestDetailFormData(null);
          setRequestDormitoryInfo(null);
        }
      } finally {
        if (!cancelled) setRequestDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showRequestDialog, showDormitoryInfoDialog, showStaffInspectionResultDialog, selectedAttachmentIndex, selectedRequest?.id]);

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

      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="pt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Save className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium text-blue-900">
                Sign Certificate Name
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[0.7rem]"
              onClick={() => {
                setEditSignatoryName(signatoryConfig?.signatory_name ?? "OSA Authorized Representative");
                setEditSignatoryTitle(signatoryConfig?.signatory_title ?? "Office of Student Affairs");
                setEditCampusDirectorName(signatoryConfig?.campus_director_name ?? "Campus Director");
                setEditCampus(signatoryConfig?.campus ?? "USTP Jasaan Campus");
                setShowSignatoryDialog(true);
              }}
            >
              <Edit3 className="h-3 w-3 mr-1" /> Edit
            </Button>
          </div>
          <div className="grid gap-2 text-xs text-slate-700">
            <p>
              <strong>OSA Authorized Representative Name:</strong>
              <span className="ml-2 font-medium text-slate-900">
                {signatoryConfig?.signatory_name ?? editSignatoryName}
              </span>
            </p>
        
            <p>
              <strong>USTP Campus Director Name:</strong>
              <span className="ml-2 font-medium text-slate-900">
                {signatoryConfig?.campus_director_name ?? editCampusDirectorName}
              </span>
            </p>
       
          </div>
          {signatoryLoading && (
            <p className="text-[0.7rem] text-muted-foreground">Loading…</p>
          )}
          {!signatoryLoading && !signatoryConfig && (
            <p className="text-[0.7rem] text-muted-foreground">
              Not configured yet. Use Edit to set the sign certificate name.
            </p>
          )}
        </CardContent>
      </Card>

      {showSignatoryDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Sign Certificate Name
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[0.7rem]"
                  onClick={() => setShowSignatoryDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-3 text-xs text-slate-800">
              <div className="space-y-2">
                <Label htmlFor="signatoryName">Signatory Name</Label>
                <Input
                  id="signatoryName"
                  value={editSignatoryName}
                  onChange={(e) => setEditSignatoryName(e.target.value)}
                  placeholder="OSA Authorized Representative"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campusDirectorName">USTP Campus Director Name</Label>
                <Input
                  id="campusDirectorName"
                  value={editCampusDirectorName}
                  onChange={(e) => setEditCampusDirectorName(e.target.value)}
                  placeholder="Campus Director"
                />
              </div>
              {signatorySaving && (
                <p className="text-[0.7rem] text-muted-foreground">
                  Saving…
                </p>
              )}
              {signatorySaveError && (
                <p className="text-xs text-red-600">{signatorySaveError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowSignatoryDialog(false)}
                  disabled={signatorySaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => void saveSignatoryConfig()}
                  disabled={signatorySaving}
                >
                  {signatorySaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
                <option value="Pending">Pending</option>
                <option value="Scheduled for Inspection">
                  Scheduled for Inspection
                </option>
                <option value="Recommended for Approval">
                  Recommended for Approval
                </option>
                <option value="Hold">Hold</option>
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
                <TableHead>Landlord</TableHead>
                <TableHead>Date Submitted</TableHead>
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
                    <div className="flex justify-center gap-2">
                      {req.status === "Recommended for Approval" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-emerald-400 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            setSelectedRequest(req);
                            setRequestDetailFormData(null);
                            setShowStaffInspectionResultDialog(true);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                          View inspection result
                        </Button>
                      )}
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
                <TableHead className="pr-4 font-semibold text-slate-600">
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
                    <div className="flex justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[0.7rem] flex items-center gap-1 border-sky-400 text-sky-600 hover:bg-sky-50 hover:text-sky-600"
                        onClick={() => {
                          window.location.href = `/osa/accreditation/${dorm.id}/certificate`;
                        }}
                      >
                        <Printer className="h-3 w-3" />
                        View Certificate
                      </Button>
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="flex w-full max-w-3xl max-h-[calc(100vh-3rem)] flex-col overflow-hidden border border-gray-300 bg-white">
            <CardHeader className="shrink-0 pb-2 border-b bg-muted/40">
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
            <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-4 text-xs text-slate-800">
              <div className="space-y-2">
                <div className="grid gap-2 md:grid-cols-[130px,1fr] items-center">
                  <span className="text-[0.7rem]">Dorm Name:</span>
                  <Input value={selectedRequest.dormName} readOnly className="h-8 text-xs" />
                  <span className="text-[0.7rem]">Landlord:</span>
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
                  <span className="text-[0.7rem]">Dormitory information:</span>
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[0.7rem]"
                      disabled={requestDetailLoading}
                      onClick={() => {
                        setShowRequestDialog(false);
                        setShowDormitoryInfoDialog(true);
                      }}
                    >
                      View Dormitory Info
                    </Button>
                  </div>
                  <span className="text-[0.7rem]">Documents (count):</span>
                  <Input
                    value={String(selectedRequest.documentsCount ?? 0)}
                    readOnly
                    className="h-8 text-xs"
                  />
                  <span className="text-[0.7rem]">Terms & Conditions:</span>
                  <div className="">
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-[0.7rem] text-black bg-white"
                      onClick={() => setShowTermsDialog(true)}
                    >
                      View Terms and Conditions
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[0.75rem] font-semibold text-slate-900">
                  Submitted attachments
                </p>
                <p className="text-[0.65rem] text-muted-foreground">
                  Files uploaded with this application. Select a file to preview it individually.
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
                    {requestAttachmentUrls.map((url, index) => {
                      const path = url.split("?")[0] ?? "";
                      const fileName = decodeURIComponent(
                        path.split("/").pop() || `Document ${index + 1}`
                      );
                      const isPreviewableImage = /\.(png|jpe?g|webp|gif)$/i.test(path);
                      return (
                        <button
                          key={`${url}-${index}`}
                          type="button"
                          className="rounded-md border border-slate-200 bg-slate-50 p-2 text-left hover:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          onClick={() => {
                            setShowRequestDialog(false);
                            setSelectedAttachmentIndex(index);
                          }}
                          aria-label={`Open ${fileName}`}
                        >
                          {isPreviewableImage ? (
                            <img
                              src={url}
                              alt={fileName}
                              className="max-h-44 w-full rounded object-contain"
                            />
                          ) : (
                            <div className="flex h-28 items-center justify-center rounded bg-white text-sm font-medium text-sky-700">
                              {fileName.toLowerCase().endsWith(".pdf")
                                ? "PDF document"
                                : "Document"}
                            </div>
                          )}
                          <span className="mt-2 block truncate text-[0.7rem] font-medium text-slate-700">
                            {fileName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                {selectedRequest.inspectionScheduleProposal?.proposedDate ||
                selectedRequest.inspectionScheduledFor ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-emerald-700">
                      Proposed Date Done
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => {
                        setInspectionDate(
                          selectedRequest.inspectionScheduleProposal?.proposedDate ??
                            selectedRequest.inspectionScheduledFor ??
                            ""
                        );
                        setShowScheduleDialog(true);
                      }}
                    >
                      Edit proposal
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      setInspectionDate("");
                      setShowScheduleDialog(true);
                    }}
                  >
                    Propose inspection date
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    setInspectionResult("Recommended for Approval");
                    setInspectionNotes("");
                    setShowInspectionResultDialog(true);
                  }}
                >
                  Inspection result
                </Button>
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
                  Hold / request docs
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

      {showStaffInspectionResultDialog && selectedRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-6">
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-inspection-result-title"
            className="w-full max-w-2xl border border-gray-300 bg-white"
          >
            <CardHeader className="border-b bg-muted/40 pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle id="staff-inspection-result-title" className="text-base font-semibold text-slate-900">
                    Inspection result
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {selectedRequest.dormName} · {selectedRequest.owner}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Close inspection result"
                  onClick={() => setShowStaffInspectionResultDialog(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="max-h-[75vh] space-y-4 overflow-y-auto pt-4 text-sm text-slate-800">
              <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <span className="text-xs font-semibold text-emerald-900">Staff inspection result</span>
                <Badge className="bg-emerald-100 text-emerald-800" variant="outline">
                  Recommended for Approval
                </Badge>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">Completed checklist</h3>
                {requestDetailLoading ? (
                  <p className="text-xs text-muted-foreground">Loading inspection checklist…</p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {OSA_INSPECTION_CHECKLIST.map((item) => {
                      const checked = savedInspectionChecklist[item.key] === true;
                      return (
                        <li
                          key={item.key}
                          className={`flex items-start justify-between gap-2 rounded-md border px-3 py-2 ${
                            checked
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <span className="text-xs text-slate-800">{item.label}</span>
                          <span className="flex shrink-0 items-center gap-1 text-[0.65rem] font-medium">
                            {checked && <Check className="h-3.5 w-3.5 text-emerald-700" />}
                            {checked ? "Checked" : "Not checked"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="space-y-1 border-t pt-3">
                <h3 className="text-sm font-semibold text-slate-900">Inspection notes</h3>
                <p className="whitespace-pre-wrap text-xs text-slate-700">
                  {requestDetailLoading ? "Loading notes…" : savedInspectionNotes || "No inspection notes were recorded."}
                </p>
              </section>

              {inspectionPdfError && (
                <p className="text-xs text-red-700">{inspectionPdfError}</p>
              )}
              <div className="flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={requestDetailLoading || inspectionPdfSaving}
                  onClick={() => void downloadInspectionResultPdf()}
                >
                  {inspectionPdfSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="mr-2 h-4 w-4" />
                  )}
                  {inspectionPdfSaving ? "Preparing PDF…" : "Download PDF"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={inspectionPdfSaving}
                  onClick={() => setShowStaffInspectionResultDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showTermsDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-6">
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="accreditation-terms-title"
            className="w-full max-w-xl border border-gray-300 bg-white"
          >
            <CardHeader className="pb-2 border-b bg-muted/40">
              <div className="flex items-center justify-between gap-3">
                <CardTitle id="accreditation-terms-title" className="text-base font-semibold text-slate-900">
                  Terms and Conditions
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Close terms and conditions"
                  onClick={() => setShowTermsDialog(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-sm text-slate-700">
              <p>
                By submitting this accreditation application, the landlord
                certifies that the information provided is true, complete, and
                accurate to the best of their knowledge.
              </p>
              <p className="font-medium text-slate-900">The applicant acknowledges that:</p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Submission does not guarantee accreditation approval.</li>
                <li>Accreditation may be revoked if compliance requirements are violated.</li>
                <li>OSA reserves the right to inspect the premises.</li>
              </ol>
              <div className="flex justify-end border-t pt-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowTermsDialog(false)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showDormitoryInfoDialog && selectedRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-6">
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="dormitory-info-title"
            className="flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden border border-gray-300 bg-white"
          >
            <CardHeader className="shrink-0 border-b bg-muted/40 pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle id="dormitory-info-title" className="text-base font-semibold text-slate-900">
                    Dormitory Information
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Property details, rooms, and photos
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Close dormitory information"
                  onClick={() => {
                    setShowDormitoryInfoDialog(false);
                    setShowRequestDialog(true);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 space-y-5 overflow-y-auto pt-4 text-sm text-slate-800">
              {requestDetailLoading ? (
                <p className="text-sm text-muted-foreground">Loading dormitory information…</p>
              ) : !requestDormitoryInfo ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No linked property or room information is available for this request.
                </div>
              ) : (
                <>
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {requestDormitoryInfo.name || selectedRequest.dormName}
                    </h3>
                    <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div><p className="text-xs text-muted-foreground">Property type</p><p>{requestDormitoryInfo.propertyType || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Address</p><p>{requestDormitoryInfo.address || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">City / Municipality</p><p>{requestDormitoryInfo.city || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Contact number</p><p>{requestDormitoryInfo.contactPhone || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Contact email</p><p className="break-all">{requestDormitoryInfo.contactEmail || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Rooms / capacity</p><p>{requestDormitoryInfo.totalRooms ?? requestDormitoryInfo.rooms.length} rooms · {requestDormitoryInfo.maxOccupancyCapacity ?? "—"} occupants</p></div>
                    </div>
                    {requestDormitoryInfo.description && (
                      <p className="whitespace-pre-wrap text-sm text-slate-700">
                        {requestDormitoryInfo.description}
                      </p>
                    )}
                    {(requestDormitoryInfo.coverImageUrl || requestDormitoryInfo.galleryImageUrls.length > 0) && (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {[requestDormitoryInfo.coverImageUrl, ...requestDormitoryInfo.galleryImageUrls]
                          .filter((url): url is string => Boolean(url))
                          .map((url) => (
                            <ProofMedia
                              key={url}
                              url={url}
                              className="max-h-56 w-full rounded border border-slate-200 object-cover"
                            />
                          ))}
                      </div>
                    )}
                  </section>

                  <section className="space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Rooms ({requestDormitoryInfo.rooms.length})
                    </h3>
                    {requestDormitoryInfo.rooms.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No rooms are registered for this property.
                      </p>
                    ) : (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {requestDormitoryInfo.rooms.map((room) => {
                          const roomPhotos = Array.from(new Set([
                            room.backgroundImageUrl,
                            ...room.roomImageUrls,
                            ...room.listingImageUrls,
                          ].filter((url): url is string => Boolean(url))));
                          const monthlyRate = Number(room.monthlyRate);
                          return (
                            <article key={room.id} className="space-y-3 rounded-md border border-slate-200 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <h4 className="font-semibold text-slate-900">Room {room.roomNumber}</h4>
                                <Badge variant="outline">{room.status}</Badge>
                              </div>
                              <div className="grid gap-2 text-xs sm:grid-cols-2">
                                <p>Capacity: <span className="font-medium">{room.capacity}</span></p>
                                <p>Monthly rate: <span className="font-medium">₱{Number.isFinite(monthlyRate) ? monthlyRate.toLocaleString() : room.monthlyRate}</span></p>
                                <p>Room size: <span className="font-medium">{room.sizeLabel || "—"}</span></p>
                                <p>Location: <span className="font-medium">{room.location || "—"}</span></p>
                              </div>
                              {(room.description || room.details || room.remarks) && (
                                <div className="space-y-1 text-xs text-slate-700">
                                  {room.description && <p>{room.description}</p>}
                                  {room.details && <p>{room.details}</p>}
                                  {room.remarks && <p>Remarks: {room.remarks}</p>}
                                </div>
                              )}
                              {roomPhotos.length > 0 && (
                                <div className="grid grid-cols-2 gap-2">
                                  {roomPhotos.map((url) => (
                                    <ProofMedia
                                      key={url}
                                      url={url}
                                      className="max-h-40 w-full rounded border border-slate-200 object-cover"
                                    />
                                  ))}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {selectedAttachmentIndex !== null && selectedAttachmentUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6"
          onClick={() => {
            setSelectedAttachmentIndex(null);
            setShowRequestDialog(true);
          }}
        >
          <Card
            role="dialog"
            aria-modal="true"
            aria-label={selectedAttachmentName}
            className="w-full max-w-5xl border border-gray-300 bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="border-b bg-muted/40 pb-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-sm font-semibold text-slate-900">
                    {selectedAttachmentName}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Document {selectedAttachmentIndex + 1} of {requestAttachmentUrls.length}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label="Close document preview"
                  onClick={() => {
                    setSelectedAttachmentIndex(null);
                    setShowRequestDialog(true);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-3 sm:p-5">
              {selectedAttachmentIsPdf ? (
                <iframe
                  src={selectedAttachmentUrl}
                  title={selectedAttachmentName}
                  className="h-[65vh] w-full rounded border border-slate-200"
                />
              ) : selectedAttachmentIsWord ? (
                <div className="flex h-[50vh] flex-col items-center justify-center gap-3 rounded border border-slate-200 bg-slate-50">
                  <p className="text-sm text-slate-600">Word documents open separately.</p>
                  <a
                    href={selectedAttachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-sky-700 underline"
                  >
                    Open document
                  </a>
                </div>
              ) : (
                <img
                  src={selectedAttachmentUrl}
                  alt={selectedAttachmentName}
                  className="mx-auto max-h-[65vh] max-w-full rounded object-contain"
                />
              )}
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={selectedAttachmentIndex === 0}
                  onClick={() => setSelectedAttachmentIndex((index) => Math.max(0, (index ?? 0) - 1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={selectedAttachmentIndex >= requestAttachmentUrls.length - 1}
                  onClick={() => setSelectedAttachmentIndex((index) => Math.min(requestAttachmentUrls.length - 1, (index ?? 0) + 1))}
                >
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showScheduleDialog && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <CardTitle className="text-base font-semibold text-slate-900">
                Propose on-site inspection date
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <p>
                Set the inspection date for{" "}
                <span className="font-semibold">{selectedRequest.dormName}</span>.
                The landlord can approve this date or choose a different one. The inspection will be scheduled after they respond.
              </p>
              <Input
                type="date"
                className="h-9 text-xs"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowScheduleDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={!inspectionDate || actionSaving}
                  onClick={async () => {
                    if (!selectedRequest || !inspectionDate) return;
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
                            inspectionScheduleProposal: inspectionDate,
                          }),
                        }
                      );
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setShowScheduleDialog(false);
                      setShowRequestDialog(false);
                      await loadData();
                    } catch (e) {
                      setLoadError(
                        e instanceof Error ? e.message : "Failed to schedule"
                      );
                    } finally {
                      setActionSaving(false);
                    }
                  }}
                >
                  {actionSaving ? "Sending…" : "Send to landlord"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showInspectionResultDialog && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <CardTitle className="text-base font-semibold text-slate-900">
                Inspection checklist result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 text-xs text-slate-800">
              <p>
                Encode results for{" "}
                <span className="font-semibold">{selectedRequest.dormName}</span>.
              </p>
              <select
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                value={inspectionResult}
                onChange={(e) => setInspectionResult(e.target.value)}
              >
                <option value="Recommended for Approval">
                  Recommended for Approval
                </option>
                <option value="Hold">Hold</option>
                <option value="Rejected">Rejected</option>
              </select>
              <textarea
                className="w-full min-h-[72px] rounded-md border border-slate-300 px-2 py-1 text-xs"
                value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
                placeholder="Notes (fire extinguisher, exits, sanitation, etc.)…"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => setShowInspectionResultDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={actionSaving}
                  onClick={async () => {
                    if (!selectedRequest) return;
                    setActionSaving(true);
                    setLoadError(null);
                    try {
                      const res = await fetch("/api/osa/inspections", {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          accreditationRequestId: selectedRequest.id,
                          result: inspectionResult,
                          notes: inspectionNotes.trim(),
                          checklist: {
                            fireExtinguisher: true,
                            emergencyExits: true,
                            sanitation: true,
                            electricalSafety: true,
                            occupancyCompliance: true,
                          },
                        }),
                      });
                      const j = (await res.json()) as { error?: string };
                      if (!res.ok) throw new Error(j.error ?? "Failed");
                      setShowInspectionResultDialog(false);
                      setShowRequestDialog(false);
                      await loadData();
                    } catch (e) {
                      setLoadError(
                        e instanceof Error ? e.message : "Failed to save"
                      );
                    } finally {
                      setActionSaving(false);
                    }
                  }}
                >
                  {actionSaving ? "Saving…" : "Submit"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Approve confirmation dialog */}
      {showApproveConfirm && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
          <Card className="w-full max-w-md border border-gray-300 bg-white">
            <CardHeader className="pb-2 border-b bg-muted/40">
              <CardTitle className="text-base font-semibold text-slate-900">
                Place application on hold
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
                            status: "Hold",
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
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/40 px-4 py-6 sm:py-10">
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

