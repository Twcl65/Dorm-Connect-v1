import type { Pool } from "pg";
import { invalidateLandlordUser, invalidateStudentUser } from "@/lib/api-cache";
import { refreshRoomFromStudentReservations } from "@/lib/landlord-db";
import { insertNotification } from "@/lib/notify-user";
import { recomputeReservationBalances } from "@/lib/payment-schedule";

export type LeaseExtensionInfo = {
  status: "Pending" | "Approved" | "Rejected";
  requestedEnd: string;
} | null;

export async function ensureLeaseExtensionColumns(pool: Pool): Promise<void> {
  await pool.query(`
    ALTER TABLE public.student_dorm_reservations
      ADD COLUMN IF NOT EXISTS lease_extension_requested_end DATE,
      ADD COLUMN IF NOT EXISTS lease_extension_status TEXT,
      ADD COLUMN IF NOT EXISTS lease_extension_requested_at TIMESTAMPTZ
  `);
}

export function mapLeaseExtension(
  status: string | null | undefined,
  requestedEnd: string | null | undefined
): LeaseExtensionInfo {
  if (!requestedEnd) return null;
  if (status !== "Pending" && status !== "Approved" && status !== "Rejected") {
    return null;
  }
  return { status, requestedEnd: requestedEnd.slice(0, 10) };
}

export async function applyApprovedLeaseExtension(
  pool: Pool,
  opts: {
    reservationId: string;
    roomId: string;
    studentUserId: string;
    ownerUserId: string;
    nextEnd: string;
    propertyName: string;
    roomNo: string;
  }
): Promise<void> {
  await pool.query(
    `UPDATE public.student_dorm_reservations
     SET lease_end = $1::date,
         lease_extension_status = 'Approved',
         updated_at = now()
     WHERE id = $2::uuid`,
    [opts.nextEnd, opts.reservationId]
  );
  await pool.query(
    `UPDATE public.landlord_tenant_leases
     SET lease_end = $1::date, updated_at = now()
     WHERE student_reservation_id = $2::uuid`,
    [opts.nextEnd, opts.reservationId]
  );
  try {
    await recomputeReservationBalances(pool, opts.reservationId);
  } catch {
    /* non-fatal */
  }
  await refreshRoomFromStudentReservations(pool, opts.roomId);
  try {
    await insertNotification(
      pool,
      opts.studentUserId,
      "Lease extension approved",
      `Your stay at ${opts.propertyName} · Room ${opts.roomNo} is now through ${opts.nextEnd}.`,
      "reservation"
    );
  } catch {
    /* non-fatal */
  }
  invalidateStudentUser(opts.studentUserId);
  invalidateLandlordUser(opts.ownerUserId);
}
