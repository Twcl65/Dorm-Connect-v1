import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";

/** Rooms a student may report against: only rooms tied to their active reservations. */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;

  try {
    const pool = await getPool();
    const { rows: resRows } = await pool.query<{
      room_id: string;
      room_no: string;
      property_name: string;
      owner_user_id: string;
    }>(
      `SELECT r.id AS room_id, r.room_no, p.name AS property_name, r.owner_user_id
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE s.student_user_id = $1::uuid
         AND s.status IN ('Pending', 'Confirmed')
       ORDER BY p.name, r.room_no`,
      [studentId]
    );

    const rooms = resRows.map((x) => ({
      roomId: x.room_id,
      roomNo: x.room_no,
      propertyName: x.property_name,
      ownerUserId: x.owner_user_id,
    }));

    return NextResponse.json({ rooms });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load rooms";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
