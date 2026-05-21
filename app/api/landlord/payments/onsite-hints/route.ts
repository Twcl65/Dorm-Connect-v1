import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOwner } from "@/lib/require-owner";

/** Occupied rooms with tenant + student ids for onsite cash entry. */
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
      room_id: string;
      room_no: string;
      property_id: string;
      property_name: string;
      tenant_name: string | null;
      tenant_lease_id: string | null;
      student_user_id: string | null;
      student_reservation_id: string | null;
    }>(
      `SELECT
         r.id AS room_id,
         r.room_no,
         p.id AS property_id,
         p.name AS property_name,
         COALESCE(
           NULLIF(trim(u.full_name), ''),
           NULLIF(trim(l_from_res.tenant_name), ''),
           NULLIF(trim(l_standalone.tenant_name), ''),
           NULLIF(trim(s.guest_name), ''),
           NULLIF(trim(lr.guest_name), '')
         ) AS tenant_name,
         COALESCE(l_from_res.id, l_standalone.id) AS tenant_lease_id,
         s.student_user_id,
         s.id AS student_reservation_id
       FROM public.landlord_rooms r
       JOIN public.landlord_properties p ON p.id = r.property_id
       LEFT JOIN LATERAL (
         SELECT res.id, res.student_user_id, res.guest_name, res.created_at
         FROM public.student_dorm_reservations res
         WHERE res.room_id = r.id
           AND res.status IN ('Pending', 'Confirmed')
         ORDER BY res.created_at DESC
         LIMIT 1
       ) s ON true
       LEFT JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
       LEFT JOIN public.landlord_tenant_leases l_from_res
         ON l_from_res.student_reservation_id = s.id
       LEFT JOIN LATERAL (
         SELECT l.id, l.tenant_name
         FROM public.landlord_tenant_leases l
         WHERE l.room_id = r.id
           AND l.owner_user_id = $1::uuid
           AND (s.id IS NULL OR l.student_reservation_id IS DISTINCT FROM s.id)
         ORDER BY l.lease_end DESC
         LIMIT 1
       ) l_standalone ON true
       LEFT JOIN LATERAL (
         SELECT lr.guest_name
         FROM public.landlord_reservations lr
         WHERE lr.room_id = r.id
           AND lr.owner_user_id = $1::uuid
           AND lr.status IN ('Confirmed', 'Pending')
         ORDER BY lr.created_at DESC
         LIMIT 1
       ) lr ON true
       WHERE r.owner_user_id = $1::uuid
       ORDER BY p.name, r.room_no`,
      [ownerId]
    );

    return NextResponse.json({
      rooms: rows.map((x) => ({
        roomId: x.room_id,
        roomNo: x.room_no,
        propertyId: x.property_id,
        propertyName: x.property_name,
        suggestedTenantName: x.tenant_name?.trim() || null,
        tenantLeaseId: x.tenant_lease_id,
        studentUserId: x.student_user_id,
        studentReservationId: x.student_reservation_id,
      })),
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to load onsite room hints";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
