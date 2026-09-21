import type { Pool } from "pg";

export type LandlordGcashDetails = {
  landlordName: string;
  gcashAccountName: string | null;
  gcashPhone: string | null;
  gcashQrCodeUrl: string | null;
};

export async function ensureLandlordGcashColumns(pool: Pool): Promise<void> {
  await pool.query(`
    ALTER TABLE public.boarding_house_app_users
      ADD COLUMN IF NOT EXISTS gcash_account_name TEXT,
      ADD COLUMN IF NOT EXISTS gcash_phone TEXT,
      ADD COLUMN IF NOT EXISTS gcash_qr_code_url TEXT
  `);
}

/** GCash details saved by the dorm owner for this student reservation. */
export async function getLandlordGcashForStudentReservation(
  pool: Pool,
  reservationId: string,
  studentId: string
): Promise<LandlordGcashDetails | null> {
  await ensureLandlordGcashColumns(pool);
  const { rows } = await pool.query<{
    landlord_name: string | null;
    gcash_account_name: string | null;
    gcash_phone: string | null;
    gcash_qr_code_url: string | null;
  }>(
    `SELECT
        COALESCE(
          NULLIF(trim(po.full_name), ''),
          NULLIF(trim(ro.full_name), ''),
          'Landlord'
        ) AS landlord_name,
        COALESCE(
          NULLIF(trim(po.gcash_account_name), ''),
          NULLIF(trim(ro.gcash_account_name), '')
        ) AS gcash_account_name,
        COALESCE(
          NULLIF(trim(po.gcash_phone), ''),
          NULLIF(trim(ro.gcash_phone), '')
        ) AS gcash_phone,
        COALESCE(
          NULLIF(trim(po.gcash_qr_code_url), ''),
          NULLIF(trim(ro.gcash_qr_code_url), '')
        ) AS gcash_qr_code_url
     FROM public.student_dorm_reservations s
     JOIN public.landlord_rooms r ON r.id = s.room_id
     JOIN public.landlord_properties p ON p.id = r.property_id
     JOIN public.boarding_house_app_users po ON po.id = p.owner_user_id
     LEFT JOIN public.boarding_house_app_users ro ON ro.id = r.owner_user_id
     WHERE s.id = $1::uuid AND s.student_user_id = $2::uuid`,
    [reservationId, studentId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    landlordName: row.landlord_name?.trim() || "Landlord",
    gcashAccountName: row.gcash_account_name?.trim() || null,
    gcashPhone: row.gcash_phone?.trim() || null,
    gcashQrCodeUrl: row.gcash_qr_code_url?.trim() || null,
  };
}
