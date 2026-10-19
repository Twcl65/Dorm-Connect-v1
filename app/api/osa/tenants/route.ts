import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaStaff } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

/** OSA/SAS tenant lookup: students with active confirmed stays (parents / staff). */
export async function GET(req: Request) {
  const session = await requireOsaStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  try {
    const pool = await getPool();

    let query = `SELECT u.id AS student_id, u.full_name, u.email, u.student_id AS school_id, u.course,
              p.name AS dorm_name, r.room_no, lu.full_name AS landlord_name,
              s.lease_start::text, s.lease_end::text,
              s.lease_extension_requested_end::text AS extension_end,
              s.lease_extension_status::text AS extension_status,
              s.status,
              CASE WHEN s.move_out_date IS NOT NULL THEN s.move_out_date::text ELSE NULL END AS move_out_date,
              s.balance_remaining::text AS balance_remaining
       FROM public.student_dorm_reservations s
       JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       JOIN public.boarding_house_app_users lu ON lu.id = r.owner_user_id
       WHERE s.status = 'Confirmed'`;

    const params: string[] = [];
    if (q.length >= 2) {
      query += ` AND (
           lower(u.full_name) LIKE '%' || $1 || '%'
           OR lower(u.email) LIKE '%' || $1 || '%'
           OR lower(trim(coalesce(u.student_id, ''))) LIKE '%' || $1 || '%'
         )`;
      params.push(q);
    }

    query += ` ORDER BY u.full_name`;

    const { rows } = await pool.query<{
      student_id: string;
      full_name: string;
      email: string;
      school_id: string | null;
      course: string | null;
      dorm_name: string;
      room_no: string;
      landlord_name: string;
      lease_start: string;
      lease_end: string;
      extension_end: string;
      extension_status: string;
      status: string;
      move_out_date: string;
      balance_remaining: string;
    }>(query, params);

    return NextResponse.json({
      tenants: rows.map((r) => ({
        studentId: r.student_id,
        name: r.full_name,
        email: r.email,
        schoolId: r.school_id,
        course: r.course,
        dormName: r.dorm_name,
        roomNo: r.room_no,
        landlordName: r.landlord_name,
        leaseStart: r.lease_start?.slice(0, 10) ?? null,
        leaseEnd: r.lease_end?.slice(0, 10) ?? null,
        extensionEnd: r.extension_end?.slice(0, 10) ?? null,
        extensionStatus: r.extension_status ?? null,
        occupancy: r.status === "Confirmed" ? "Active" : r.status,
        moveOutDate: r.move_out_date?.slice(0, 10) ?? null,
        balanceRemaining: Number(r.balance_remaining ?? "0") || 0,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load tenants";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
