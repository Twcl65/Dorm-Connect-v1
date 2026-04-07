import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

type InspectionResult = "Compliant" | "Warning" | "Non-Compliant";

export async function GET() {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      property_id: string;
      dorm_name: string;
      compliance_status: string;
      last_inspection_at: Date | null;
      operational_status: string;
    }>(
      `SELECT p.id AS property_id, p.name AS dorm_name, p.compliance_status,
              p.last_inspection_at, p.operational_status
       FROM public.landlord_properties p
       WHERE EXISTS (
         SELECT 1 FROM public.landlord_accreditation_requests a
         WHERE a.property_id = p.id AND a.status = 'Approved'
       )
       ORDER BY p.name`
    );

    const mapResult = (c: string): InspectionResult => {
      if (c === "Warning") return "Warning";
      if (c === "Non-Compliant") return "Non-Compliant";
      return "Compliant";
    };

    const inspections = rows.map((r, i) => {
      const result = mapResult(r.compliance_status);
      const dateStr = r.last_inspection_at
        ? new Date(r.last_inspection_at).toISOString().slice(0, 10)
        : "—";
      let nextAction = "No follow-up recorded.";
      if (result === "Warning") {
        nextAction = "Schedule follow-up inspection or verify corrective actions.";
      } else if (result === "Non-Compliant") {
        nextAction = "Require corrective action plan before next occupancy review.";
      } else if (r.operational_status === "Under Inspection") {
        nextAction = "OSA inspection in progress.";
      } else {
        nextAction = "Continue routine monitoring.";
      }
      return {
        id: `INSP-${String(i + 1).padStart(3, "0")}`,
        propertyId: r.property_id,
        dormName: r.dorm_name,
        inspectionDate: dateStr,
        result,
        nextAction,
      };
    });

    const compliant = inspections.filter((x) => x.result === "Compliant").length;
    const warnings = inspections.filter((x) => x.result === "Warning").length;
    const nonCompliant = inspections.filter(
      (x) => x.result === "Non-Compliant"
    ).length;
    const inspectionDue = inspections.filter(
      (x) => x.inspectionDate === "—" || x.result !== "Compliant"
    ).length;

    return NextResponse.json({
      summary: { compliant, warnings, nonCompliant, inspectionDue },
      inspections,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load safety data";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
