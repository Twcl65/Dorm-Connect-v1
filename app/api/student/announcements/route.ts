import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;

  try {
    const pool = await getPool();
    const { rows: osa } = await pool.query<{
      id: string;
      title: string;
      body: string;
      posted_at: Date;
    }>(
      `SELECT id, title, body, posted_at
       FROM public.student_announcements
       WHERE is_active = true AND audience IN ('Students', 'All')
       ORDER BY posted_at DESC`
    );

    const { rows: landlordRows } = await pool.query<{
      id: string;
      title: string;
      body: string;
      created_at: Date;
      property_name: string;
    }>(
      `SELECT lta.id, lta.title, lta.body, lta.created_at, p.name AS property_name
       FROM public.landlord_tenant_announcements lta
       JOIN public.landlord_properties p ON p.id = lta.property_id
       WHERE EXISTS (
         SELECT 1
         FROM public.student_dorm_reservations s
         JOIN public.landlord_rooms r ON r.id = s.room_id
         WHERE s.student_user_id = $1::uuid
           AND s.status IN ('Pending', 'Confirmed')
           AND r.property_id = lta.property_id
           AND (
             lta.audience = 'all_booked'
             OR (
               lta.audience = 'single_student'
               AND lta.target_student_user_id = $1::uuid
             )
           )
       )
       ORDER BY lta.created_at DESC`,
      [studentId]
    );

    const merged: {
      id: string;
      title: string;
      message: string;
      date: string;
      source: "osa" | "landlord";
      propertyName?: string;
    }[] = [
      ...osa.map((r) => ({
        id: `osa-${r.id}`,
        title: r.title,
        message: r.body,
        date: new Date(r.posted_at).toISOString().slice(0, 10),
        source: "osa" as const,
      })),
      ...landlordRows.map((r) => ({
        id: `landlord-${r.id}`,
        title: r.title,
        message: r.body,
        date: new Date(r.created_at).toISOString().slice(0, 10),
        source: "landlord" as const,
        propertyName: r.property_name,
      })),
    ];

    merged.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json({ announcements: merged });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
