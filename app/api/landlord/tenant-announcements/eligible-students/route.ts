import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;
  const propertyId = new URL(req.url).searchParams.get("propertyId")?.trim();
  if (!propertyId || !/^[0-9a-f-]{36}$/i.test(propertyId)) {
    return NextResponse.json(
      { error: "propertyId query parameter is required." },
      { status: 400 }
    );
  }

  try {
    const pool = await getPool();
    const { rows: prop } = await pool.query(
      `SELECT 1 FROM public.landlord_properties
       WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
      [propertyId, ownerId]
    );
    if (!prop.length) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    const { rows } = await pool.query<{
      student_user_id: string;
      full_name: string;
      room_no: string;
    }>(
      `SELECT DISTINCT s.student_user_id, u.full_name, r.room_no
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
       WHERE r.property_id = $1::uuid
         AND r.owner_user_id = $2::uuid
         AND s.status IN ('Pending', 'Confirmed')
       ORDER BY u.full_name, r.room_no`,
      [propertyId, ownerId]
    );

    return NextResponse.json({
      students: rows.map((x) => ({
        studentUserId: x.student_user_id,
        fullName: x.full_name,
        roomNo: x.room_no,
      })),
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to load eligible students";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
