import type { Pool } from "pg";

/** Marks approved accreditations past `accreditation_expires_at` as Expired. */
export async function expireAccreditationsIfNeeded(pool: Pool): Promise<void> {
  await pool.query(
    `UPDATE public.landlord_accreditation_requests
     SET status = 'Expired', updated_at = now()
     WHERE status = 'Approved'
       AND accreditation_expires_at IS NOT NULL
       AND accreditation_expires_at < now()`
  );
}
