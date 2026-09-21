import { NextResponse, NextRequest } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type");

  try {
    const pool = await getPool();

    if (type === "registered") {
      const { rows } = await pool.query(
        `SELECT p.name as "PropertyName", p.property_type as "Type", u.full_name as "OwnerName", p.address as "Address", p.operational_status as "Status"
         FROM public.landlord_properties p
         LEFT JOIN public.boarding_house_app_users u ON p.owner_user_id = u.id
         ORDER BY p.name ASC`
      );
      return NextResponse.json({ data: rows });
    }

    if (type === "accredited") {
      const { rows } = await pool.query(
        `SELECT p.name as "PropertyName", p.property_type as "Type", u.full_name as "OwnerName", p.address as "Address", a.accreditation_expires_at::date::text as "ExpiryDate"
         FROM public.landlord_accreditation_requests a
         JOIN public.landlord_properties p ON a.property_id = p.id
         LEFT JOIN public.boarding_house_app_users u ON p.owner_user_id = u.id
         WHERE a.status = 'Approved'
         ORDER BY p.name ASC`
      );
      return NextResponse.json({ data: rows });
    }

    if (type === "noncompliant") {
      const { rows } = await pool.query(
        `SELECT p.name as "PropertyName", p.property_type as "Type", u.full_name as "OwnerName", p.address as "Address", p.compliance_status as "ComplianceStatus"
         FROM public.landlord_properties p
         LEFT JOIN public.boarding_house_app_users u ON p.owner_user_id = u.id
         WHERE p.compliance_status IN ('Warning', 'Non-Compliant')
         ORDER BY p.name ASC`
      );
      return NextResponse.json({ data: rows });
    }

    if (type === "students") {
      const { rows } = await pool.query(
        `SELECT l.tenant_name as "TenantName", p.name as "PropertyName", r.room_no as "RoomNo", l.lease_start::date::text as "LeaseStart", l.lease_end::date::text as "LeaseEnd", l.payment_status as "PaymentStatus"
         FROM public.landlord_tenant_leases l
         JOIN public.landlord_properties p ON l.property_id = p.id
         JOIN public.landlord_rooms r ON l.room_id = r.id
         WHERE l.lease_end >= CURRENT_DATE
         ORDER BY l.tenant_name ASC`
      );
      return NextResponse.json({ data: rows });
    }

    if (type === "inspections") {
      const { rows } = await pool.query(
        `SELECT p.name as "PropertyName", p.property_type as "Type", u.full_name as "OwnerName", i.scheduled_for::date::text as "ScheduledDate", i.result as "Result"
         FROM public.os_accredit_inspections i
         JOIN public.landlord_accreditation_requests a ON i.accreditation_request_id = a.id
         JOIN public.landlord_properties p ON a.property_id = p.id
         LEFT JOIN public.boarding_house_app_users u ON p.owner_user_id = u.id
         WHERE i.scheduled_for >= CURRENT_DATE OR i.result IS NULL
         ORDER BY i.scheduled_for ASC`
      );
      // Fallback: If os_accredit_inspections is empty but accreditation requests have 'Scheduled for Inspection'
      if (rows.length === 0) {
        const { rows: fallbackRows } = await pool.query(
          `SELECT p.name as "PropertyName", p.property_type as "Type", u.full_name as "OwnerName", a.inspection_scheduled_for::date::text as "ScheduledDate", 'Scheduled' as "Result"
           FROM public.landlord_accreditation_requests a
           JOIN public.landlord_properties p ON a.property_id = p.id
           LEFT JOIN public.boarding_house_app_users u ON p.owner_user_id = u.id
           WHERE a.status = 'Scheduled for Inspection'
           ORDER BY a.inspection_scheduled_for ASC`
        );
        return NextResponse.json({ data: fallbackRows });
      }

      return NextResponse.json({ data: rows });
    }

    // Default: summary stats for the UI page if type is not specified
    const { rows: propertyTotals } = await pool.query(`SELECT COUNT(*)::text as count FROM public.landlord_properties`);
    const { rows: accreditedTotals } = await pool.query(`SELECT COUNT(*)::text as count FROM public.landlord_accreditation_requests WHERE status = 'Approved'`);
    const { rows: nonCompliantTotals } = await pool.query(`SELECT COUNT(*)::text as count FROM public.landlord_properties WHERE compliance_status IN ('Warning', 'Non-Compliant')`);
    const { rows: activeLeases } = await pool.query(`SELECT COUNT(*)::text as count FROM public.landlord_tenant_leases WHERE lease_end >= CURRENT_DATE`);
    const { rows: scheduledInspections } = await pool.query(`SELECT COUNT(*)::text as count FROM public.os_accredit_inspections WHERE result IS NULL AND scheduled_for >= CURRENT_DATE`);
    const { rows: scheduledRequests } = await pool.query(`SELECT COUNT(*)::text as count FROM public.landlord_accreditation_requests WHERE status = 'Scheduled for Inspection'`);
    
    return NextResponse.json({
      summary: {
        totalProperties: parseInt(propertyTotals[0]?.count || "0", 10),
        accreditedProperties: parseInt(accreditedTotals[0]?.count || "0", 10),
        nonCompliantProperties: parseInt(nonCompliantTotals[0]?.count || "0", 10),
        studentsRenting: parseInt(activeLeases[0]?.count || "0", 10),
        scheduledInspections: Math.max(
          parseInt(scheduledInspections[0]?.count || "0", 10),
          parseInt(scheduledRequests[0]?.count || "0", 10)
        )
      }
    });
  } catch (e) {
    console.error("Reports API error:", e);
    const msg = e instanceof Error ? e.message : "Failed to load reports";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
