import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pool = await getPool();
    const { rows: counts } = await pool.query<{
      pending: string;
      approved: string;
      rejected: string;
      needs_docs: string;
      not_operating: string;
      compliance_alerts: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM public.landlord_accreditation_requests
          WHERE status IN (
            'Pending',
            'Scheduled for Inspection',
            'Recommended for Approval',
            'Hold'
          )) AS pending,
         (SELECT COUNT(*)::text FROM public.landlord_accreditation_requests WHERE status = 'Approved') AS approved,
         (SELECT COUNT(*)::text FROM public.landlord_accreditation_requests WHERE status = 'Rejected') AS rejected,
         (SELECT COUNT(*)::text FROM public.landlord_accreditation_requests WHERE status = 'Hold') AS needs_docs,
         (SELECT COUNT(*)::text FROM public.landlord_properties WHERE operational_status = 'Not Operating') AS not_operating,
         (SELECT COUNT(*)::text FROM public.landlord_properties
          WHERE compliance_status IN ('Warning', 'Non-Compliant')) AS compliance_alerts`
    );
    const c = counts[0];

    const { rows: recentRequests } = await pool.query<{
      id: string;
      dorm_name: string;
      owner_name: string;
      status: string;
      submitted_at: Date;
    }>(
      `SELECT a.id, a.dorm_name, u.full_name AS owner_name, a.status, a.submitted_at
       FROM public.landlord_accreditation_requests a
       JOIN public.boarding_house_app_users u ON u.id = a.owner_user_id
       ORDER BY a.submitted_at DESC
       LIMIT 8`
    );

    const { rows: progressRows } = await pool.query<{
      status: string;
      count: string;
    }>(
      `SELECT status, COUNT(*)::text AS count
       FROM public.landlord_accreditation_requests
       GROUP BY status`
    );

    const accreditationProgress = progressRows.map((r) => ({
      status: r.status,
      count: Number(r.count),
    }));

    return NextResponse.json({
      pendingAccreditation: Number(c?.pending ?? 0),
      approvedDorms: Number(c?.approved ?? 0),
      rejectedApplications: Number(c?.rejected ?? 0),
      needsDocuments: Number(c?.needs_docs ?? 0),
      dormsNotOperating: Number(c?.not_operating ?? 0),
      complianceAlerts: Number(c?.compliance_alerts ?? 0),
      recentRequests: recentRequests.map((r) => ({
        id: r.id,
        name: r.dorm_name,
        owner: r.owner_name,
        date: formatDate(new Date(r.submitted_at)),
        status: r.status,
      })),
      accreditationProgress,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load overview";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
