"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet, Building2, ShieldCheck, AlertTriangle, Users, CalendarClock } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type ReportType = "registered" | "accredited" | "noncompliant" | "students" | "inspections";

const REPORTS = [
  {
    type: "registered" as ReportType,
    title: "Registered Properties",
    description: "Full list of all dormitories and boarding houses registered in the system.",
    icon: Building2,
    color: "text-blue-500",
    bg: "bg-blue-50",
  },
  {
    type: "accredited" as ReportType,
    title: "Accredited Properties",
    description: "List of properties that have successfully passed the OSA accreditation process.",
    icon: ShieldCheck,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  {
    type: "noncompliant" as ReportType,
    title: "Non-Compliant Properties",
    description: "Properties flagged with warnings or non-compliant accreditation status.",
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-50",
  },
  {
    type: "students" as ReportType,
    title: "Students Renting",
    description: "List of all active student tenant leases across all properties.",
    icon: Users,
    color: "text-brand",
    bg: "bg-brand/10",
  },
  {
    type: "inspections" as ReportType,
    title: "Scheduled Inspections",
    description: "List of properties currently scheduled for upcoming OSA inspections.",
    icon: CalendarClock,
    color: "text-amber-500",
    bg: "bg-amber-50",
  },
];

export default function GenerateReportsPage() {
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReportData = async (type: ReportType) => {
    try {
      const res = await fetch(`/api/osa/reports?type=${type}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch report data");
      return json.data as Record<string, string | number>[];
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error generating report");
      return null;
    }
  };

  const generatePDF = async (report: typeof REPORTS[0]) => {
    setLoadingType(`pdf-${report.type}`);
    setError(null);
    const data = await fetchReportData(report.type);
    setLoadingType(null);
    
    if (!data || data.length === 0) {
      setError(`No data available for ${report.title}`);
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`OSA Report: ${report.title}`, 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total Records: ${data.length}`, 14, 36);

    const headers = Object.keys(data[0]);
    const body = data.map(row => headers.map(key => String(row[key] || "")));

    autoTable(doc, {
      startY: 45,
      head: [headers],
      body: body,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 9 },
    });

    doc.save(`OSA_${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const generateExcel = async (report: typeof REPORTS[0]) => {
    setLoadingType(`excel-${report.type}`);
    setError(null);
    const data = await fetchReportData(report.type);
    setLoadingType(null);

    if (!data || data.length === 0) {
      setError(`No data available for ${report.title}`);
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Auto-size columns roughly based on header length
    const cols = Object.keys(data[0]).map(key => ({ wch: Math.max(key.length + 5, 15) }));
    ws['!cols'] = cols;

    XLSX.utils.book_append_sheet(wb, ws, "Report Data");
    XLSX.writeFile(wb, `OSA_${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generate Detailed Reports</h1>
        <p className="text-muted-foreground mt-1">
          Export itemized, formatted lists in PDF or Excel format for record keeping and analysis.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          const isPdfLoading = loadingType === `pdf-${report.type}`;
          const isExcelLoading = loadingType === `excel-${report.type}`;

          return (
            <Card key={report.type} className="flex flex-col">
              <CardHeader className="pb-4 border-b-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${report.bg}`}>
                    <Icon className={`w-5 h-5 ${report.color}`} />
                  </div>
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                </div>
                <CardDescription className="min-h-[40px]">
                  {report.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <div className="flex gap-2">
                  <Button 
                    onClick={() => void generateExcel(report)} 
                    variant="outline" 
                    className="flex-1 gap-2 bg-green-50/50 hover:bg-green-100 hover:text-green-700 border-green-200"
                    disabled={isExcelLoading || isPdfLoading}
                  >
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    {isExcelLoading ? "Wait..." : "Excel"}
                  </Button>
                  <Button 
                    onClick={() => void generatePDF(report)} 
                    className="flex-1 gap-2"
                    disabled={isPdfLoading || isExcelLoading}
                  >
                    <FileText className="h-4 w-4" />
                    {isPdfLoading ? "Wait..." : "PDF"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
