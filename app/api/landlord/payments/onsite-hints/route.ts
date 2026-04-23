import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOwner } from "@/lib/require-owner";

/** Room numbers with best-known tenant name for onsite cash entry (student app > lease > manual reservation). */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      room_no: string;
      suggested_name: string | null;
    }>(
      `SELECT r.room_no,
              COALESCE(
                (SELECT u.full_name
                 FROM public.student_dorm_reservations s
                 JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
                 WHERE s.room_id = r.id
                   AND s.status IN ('Pending', 'Confirmed')
                 ORDER BY s.created_at DESC
                 LIMIT 1),
                (SELECT l.tenant_name
                 FROM public.landlord_tenant_leases l
                 WHERE l.room_id = r.id AND l.owner_user_id = r.owner_user_id
                 ORDER BY l.lease_end DESC
                 LIMIT 1),
                (SELECT lr.guest_name
                 FROM public.landlord_reservations lr
                 WHERE lr.room_id = r.id
                   AND lr.owner_user_id = r.owner_user_id
                   AND lr.status IN ('Confirmed', 'Pending')
                 ORDER BY lr.created_at DESC
                 LIMIT 1)
              ) AS suggested_name
       FROM public.landlord_rooms r
       WHERE r.owner_user_id = $1::uuid
       ORDER BY r.room_no`,
      [ownerId]
    );

    return NextResponse.json({
      rooms: rows.map((x) => ({
        roomNo: x.room_no,
        suggestedTenantName: x.suggested_name?.trim() || null,
      })),
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to load onsite room hints";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
