import type { Pool } from "pg";

export type UnpaidStayElsewhere = {
  reservationId: string;
  propertyId: string;
  dormName: string;
  roomNo: string;
  leaseStart: string;
  leaseEnd: string;
  rentPaymentStatus: string;
  balanceRemaining: number;
};

/** Confirmed stays with unpaid rent at properties other than `excludePropertyId`. */
export async function fetchStudentUnpaidStaysElsewhere(
  pool: Pool,
  studentUserId: string,
  excludePropertyId: string
): Promise<UnpaidStayElsewhere[]> {
  const { rows } = await pool.query<{
    reservation_id: string;
    property_id: string;
    dorm_name: string;
    room_no: string;
    lease_start: string;
    lease_end: string;
    rent_payment_status: string;
    balance_remaining: string;
  }>(
    `SELECT s.id AS reservation_id,
            p.id AS property_id,
            COALESCE(
              NULLIF(trim(a.dorm_name), ''),
              NULLIF(trim(p.name), ''),
              'Boarding house'
            ) AS dorm_name,
            r.room_no,
            s.lease_start::text,
            s.lease_end::text,
            s.rent_payment_status,
            s.balance_remaining::text
     FROM public.student_dorm_reservations s
     JOIN public.landlord_rooms r ON r.id = s.room_id
     JOIN public.landlord_properties p ON p.id = r.property_id
     LEFT JOIN LATERAL (
       SELECT ar.dorm_name
       FROM public.landlord_accreditation_requests ar
       WHERE ar.property_id = p.id
          OR ar.owner_user_id = p.owner_user_id
       ORDER BY ar.submitted_at DESC NULLS LAST
       LIMIT 1
     ) a ON true
     WHERE s.student_user_id = $1::uuid
       AND s.status = 'Confirmed'
       AND p.id <> $2::uuid
       AND (
         s.rent_payment_status IN ('Pending', 'Overdue')
         OR COALESCE(s.balance_remaining, 0) > 0
       )
     ORDER BY s.lease_start`,
    [studentUserId, excludePropertyId]
  );

  return rows.map((r) => ({
    reservationId: r.reservation_id,
    propertyId: r.property_id,
    dormName: r.dorm_name,
    roomNo: r.room_no,
    leaseStart: r.lease_start.slice(0, 10),
    leaseEnd: r.lease_end.slice(0, 10),
    rentPaymentStatus: r.rent_payment_status,
    balanceRemaining: Number(r.balance_remaining) || 0,
  }));
}
