import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireIctAdminUnlessBootstrapEmpty } from "@/lib/admin-api-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!(await requireIctAdminUnlessBootstrapEmpty())) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const pool = await getPool();
    const { rows } = await pool.query<{
      dormitories: string;
      rooms: string;
      student_reservations: string;
      landlord_reservations: string;
      accredited: string;
      pending_accreditation: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM public.landlord_properties) AS dormitories,
         (SELECT COUNT(*)::text FROM public.landlord_rooms) AS rooms,
         (SELECT COUNT(*)::text FROM public.student_dorm_reservations) AS student_reservations,
         (SELECT COUNT(*)::text FROM public.landlord_reservations) AS landlord_reservations,
         (SELECT COUNT(*)::text FROM public.landlord_accreditation_requests WHERE status = 'Approved') AS accredited,
         (SELECT COUNT(*)::text FROM public.landlord_accreditation_requests
          WHERE status IN ('Submitted', 'In Review', 'Needs Documents')) AS pending_accreditation`
    );
    const r = rows[0];
    return NextResponse.json({
      dormitories: Number(r?.dormitories ?? 0),
      rooms: Number(r?.rooms ?? 0),
      studentReservations: Number(r?.student_reservations ?? 0),
      landlordReservations: Number(r?.landlord_reservations ?? 0),
      accredited: Number(r?.accredited ?? 0),
      pendingAccreditation: Number(r?.pending_accreditation ?? 0),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load stats";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
