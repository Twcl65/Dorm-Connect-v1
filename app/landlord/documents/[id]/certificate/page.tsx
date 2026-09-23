"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ChevronLeft } from "lucide-react";

type CertificateData = {
  id: string;
  dormName: string;
  address: string;
  status: string;
  updatedAt: string;
  accreditationExpiresAt: string | null;
};

export default function LandlordCertificatePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const [data, setData] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/landlord/accreditation/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Trigger print dialog automatically when data is loaded
  useEffect(() => {
    if (data) {
      setTimeout(() => window.print(), 500);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <div className="text-red-500 font-medium">{error || "Certificate not found"}</div>
        <Button onClick={() => router.back()} variant="outline">
          <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Non-printable controls */}
      <div className="flex items-center justify-between no-print rounded-lg border bg-white p-4 shadow-sm">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Back to Accreditation
        </Button>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => window.print()}
        >
          <Printer className="mr-2 h-4 w-4" /> Print / Download
        </Button>
      </div>

      {/* Print styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          #printable-certificate, #printable-certificate * {
            visibility: visible;
          }
          #printable-certificate {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}} />

      {/* Certificate Container */}
      <div
        id="printable-certificate"
        className="bg-white border-2 border-slate-200 shadow-xl mx-auto p-12 relative flex flex-col items-center text-center"
        style={{ minHeight: "297mm", width: "210mm", boxSizing: "border-box" }}
      >
        {/* Header Section */}
        <div className="w-full flex flex-col items-center space-y-4 mb-15">
          <div className="relative w-[150px] h-[80px]">
            <img
              src="/ustpl.png"
              alt="USTP Logo"
              className="object-contain w-full h-full"
            />
          </div>

          <div className="w-full text-center space-y-1">
            <h2 className="text-sm font-bold tracking-wider uppercase">University of Science and Technology of Southern Philippines</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Alubijid | Balubal | Cagayan de Oro | Claveria | Jasaan | Oroquieta | Panaon | Villanueva</p>
          </div>

          <div className="w-full text-center space-y-1 mt-6">
            <h3 className="font-bold text-sm tracking-wide">UNIVERSITY OF SCIENCE AND TECHNOLOGY</h3>
            <h3 className="font-bold text-sm tracking-wide">OF SOUTHERN PHILIPPINES – JASAAN CAMPUS</h3>
            <p className="text-xs tracking-wider">OFFICE OF STUDENT AFFAIRS (OSA)</p>
          </div>

          <div className="relative w-[120px] h-[60px] mt-4">
            <img
              src="/OSA Logo.jpg"
              alt="OSA Logo"
              className="object-contain w-full h-full"
            />
          </div>
        </div>

        {/* Certificate Title */}
        <div className="my-3">
          <h1 className="text-3xl font-black tracking-widest uppercase mb-4 text-slate-900">Certificate of Accreditation</h1>
          <p className="text-sm text-slate-600">This is to certify that</p>
        </div>

        {/* Dynamic Content */}
        <div className="w-full max-w-2xl mx-auto mb-10 space-y-6">
          <div className="border-b border-black pb-2 px-5">
            <h2 className="text-2xl font-bold text-slate-900">{data.dormName}</h2>
          </div>
          <p className="text-xs text-slate-500">(Name of Dormitory / Boarding House)</p>

          <div className="flex items-end justify-center gap-2 mt-8">
            <span className="text-sm text-slate-700">located at</span>
            <div className="border-b border-black w-3/5 pb-1">
              <span className="text-sm font-medium">{data.address || "N/A"}</span>
            </div>
          </div>
          <p className="text-xs text-slate-500">(Address)</p>
        </div>

        {/* Certification Text */}
        <div className="w-full max-w-3xl mx-auto text-sm leading-loose text-justify px-8 mb-16">
          has been reviewed and assessed by the <strong>Office of Student Affairs (OSA)</strong> and is hereby recognized as an <strong>ACCREDITED DORMITORY / BOARDING HOUSE</strong> for student accommodation, subject to the applicable institutional requirements and policies.
        </div>

        {/* Certificate Details */}
        <div className="w-full max-w-3xl mx-auto grid grid-cols-2 gap-x-12 gap-y-6 text-sm mb-5 text-left px-8">
          <div className="flex justify-between items-end border-b border-black pb-1">
            <span className="text-slate-600 font-medium">Certificate No.:</span>
            <span className="font-bold">{data.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between items-end border-b border-black pb-1">
            <span className="text-slate-600 font-medium">Date Issued:</span>
            <span className="font-bold">{new Date(data.updatedAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between items-end border-b border-black pb-1">
            <span className="text-slate-600 font-medium">Valid Until:</span>
            <span className="font-bold">{data.accreditationExpiresAt ? new Date(data.accreditationExpiresAt).toLocaleDateString() : "N/A"}</span>
          </div>
          <div className="flex justify-between items-end border-b border-black pb-1">
            <span className="text-slate-600 font-medium">Accreditation Status:</span>
            <span className="font-bold">{data.status}</span>
          </div>
        </div>

        {/* Signatures */}
        <div className="w-full max-w-3xl mx-auto grid grid-cols-2 gap-x-12 mt-auto px-8 mb-16">
          <div className="text-center flex flex-col items-center">
            <div className="w-full border-b border-black mb-2"></div>
            <p className="text-xs font-semibold">OSA Authorized Representative</p>
            <p className="text-[10px] text-slate-500">Office of Student Affairs</p>
          </div>
          <div className="text-center flex flex-col items-center">
            <div className="w-full border-b border-black mb-2"></div>
            <p className="text-xs font-semibold">Campus Director</p>
            <p className="text-[10px] text-slate-500">USTP Jasaan Campus</p>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 w-full text-center">
          <p className="text-[9px] italic text-slate-500">
            This certificate is issued for institutional accreditation and monitoring purposes.<br />
            Certificate validity and requirements are subject to OSA policies.
          </p>
        </div>
      </div>
    </div>
  );
}
