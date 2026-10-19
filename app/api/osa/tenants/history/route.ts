import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaStaff } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireOsaStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "studentId is required." }, { status: 400 });
  }

  try {
    const pool = await getPool();

    const { rows } = await pool.query<{
      dorm_name: string;
      lease_start: Date;
      lease_end: Date;
      balance_remaining: string;
      status: string;
      room_no: string;
      property_name: string;
      history_status: string | null;
    }>(
      `SELECT p.name AS dorm_name, l.room_no, s.lease_start, s.lease_end, s.status,
              s.balance_remaining::text AS balance_remaining,
              CASE WHEN s.move_out_date IS NOT NULL THEN s.status ELSE NULL END AS history_status
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms l ON l.id = s.room_id
       JOIN public.landlord_properties p ON p.id = l.property_id
       WHERE s.student_user_id = $1::uuid
         AND s.status = 'Confirmed'
       ORDER BY s.lease_start ASC`,
      [studentId]
    );

    return NextResponse.json({
      history: rows.map((r) => ({
        dormName: r.dorm_name,
        roomNo: r.room_no,
        leaseStart: r.lease_start.toISOString().slice(0, 10),
        leaseEnd: r.lease_end.toISOString().slice(0, 10),
        balanceRemaining: r.balance_remaining,
        status: r.history_status ?? r.status,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load history";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
