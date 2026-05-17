import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

/** OSA/SAS tenant lookup: students with active confirmed stays (parents / staff). */
export async function GET(req: Request) {
  const session = await requireOsaAdmin();
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
              CASE WHEN s.status = 'Confirmed' THEN 'Active' ELSE s.status END AS occupancy
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
      occupancy: string;
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
        leaseStart: r.lease_start.slice(0, 10),
        leaseEnd: r.lease_end.slice(0, 10),
        occupancy: r.occupancy,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load tenants";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
