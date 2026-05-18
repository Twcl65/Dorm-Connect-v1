import type { Pool } from "pg";

const PLACEHOLDER_PROPERTY_NAMES = new Set(["", "my property"]);

/** Prefer real property name; fall back to latest accreditation dorm name. */
export function resolveDormDisplayName(
  propertyName: string | null | undefined,
  accreditationDormName: string | null | undefined,
  fallback = "Dorm name not set"
): string {
  const raw = (propertyName ?? "").trim();
  if (raw && !PLACEHOLDER_PROPERTY_NAMES.has(raw.toLowerCase())) {
    return raw;
  }
  const acc = (accreditationDormName ?? "").trim();
  if (acc) return acc;
  if (raw) return raw;
  return fallback;
}

export async function ensureLandlordProperty(
  pool: Pool,
  ownerId: string
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM public.landlord_properties
     WHERE owner_user_id = $1::uuid
     ORDER BY created_at ASC
     LIMIT 1`,
    [ownerId]
  );
  if (rows[0]) return rows[0].id;

  const { rows: accRows } = await pool.query<{ dorm_name: string }>(
    `SELECT dorm_name FROM public.landlord_accreditation_requests
     WHERE owner_user_id = $1::uuid AND trim(dorm_name) <> ''
     ORDER BY submitted_at DESC
     LIMIT 1`,
    [ownerId]
  );
  const initialName =
    accRows[0]?.dorm_name?.trim() || "Unnamed dormitory";

  const ins = await pool.query<{ id: string }>(
    `INSERT INTO public.landlord_properties (owner_user_id, name)
     VALUES ($1::uuid, $2)
     RETURNING id`,
    [ownerId, initialName]
  );
  const row = ins.rows[0];
  if (!row) throw new Error("Could not create property");
  return row.id;
}

export async function landlordLog(
  pool: Pool,
  ownerId: string,
  description: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO public.landlord_activity_log (owner_user_id, description)
       VALUES ($1::uuid, $2)`,
      [ownerId, description]
    );
  } catch {
    /* non-fatal */
  }
}

export function formatLeasePeriod(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    year: "numeric",
  };
  const a = start.toLocaleDateString("en-US", opts);
  const b = end.toLocaleDateString("en-US", opts);
  return `${a} - ${b}`;
}

export type RoomListingStatus =
  | "Occupied"
  | "Available"
  | "Reserved"
  | "Maintenance";

export type LeasePaymentStatus = "Paid" | "Pending" | "Overdue";

export function mapRentPaymentStatus(
  rentStatus: string | null | undefined
): LeasePaymentStatus {
  if (rentStatus === "Paid") return "Paid";
  if (rentStatus === "Overdue") return "Overdue";
  return "Pending";
}

type BookingInputs = {
  dbRoomStatus: string;
  hasLease: boolean;
  studentReservationStatus: "Pending" | "Confirmed" | null;
  manualReservationStatus: "Pending" | "Confirmed" | null;
};

/** Room status from active lease / student or manual reservation. */
export function resolveRoomListingStatus(
  input: BookingInputs
): RoomListingStatus {
  if (input.dbRoomStatus === "Maintenance") return "Maintenance";
  if (input.hasLease) return "Occupied";
  if (input.studentReservationStatus === "Confirmed") return "Occupied";
  if (input.manualReservationStatus === "Confirmed") return "Occupied";
  if (input.studentReservationStatus === "Pending") return "Reserved";
  if (input.manualReservationStatus === "Pending") return "Reserved";
  return "Available";
}

/**
 * Sync room status from leases and reservations (student + manual).
 * Confirmed / active lease → Occupied; Pending only → Reserved.
 */
export async function refreshRoomFromStudentReservations(
  pool: Pool,
  roomId: string
): Promise<void> {
  const { rows: roomRows } = await pool.query<{ status: string }>(
    `SELECT status FROM public.landlord_rooms WHERE id = $1::uuid`,
    [roomId]
  );
  const dbStatus = roomRows[0]?.status ?? "Available";
  if (dbStatus === "Maintenance") return;

  const { rows: leaseRows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM public.landlord_tenant_leases WHERE room_id = $1::uuid`,
    [roomId]
  );
  const hasLease = Number(leaseRows[0]?.c ?? 0) > 0;

  const { rows: studentRows } = await pool.query<{ status: string }>(
    `SELECT status FROM public.student_dorm_reservations
     WHERE room_id = $1::uuid AND status IN ('Pending', 'Confirmed')
     ORDER BY CASE status WHEN 'Confirmed' THEN 0 ELSE 1 END, created_at DESC
     LIMIT 1`,
    [roomId]
  );
  const studentStatus = studentRows[0]?.status as
    | "Pending"
    | "Confirmed"
    | undefined;

  const { rows: manualRows } = await pool.query<{ status: string }>(
    `SELECT status FROM public.landlord_reservations
     WHERE room_id = $1::uuid AND status IN ('Pending', 'Confirmed')
     ORDER BY CASE status WHEN 'Confirmed' THEN 0 ELSE 1 END, created_at DESC
     LIMIT 1`,
    [roomId]
  );
  const manualStatus = manualRows[0]?.status as
    | "Pending"
    | "Confirmed"
    | undefined;

  const next = resolveRoomListingStatus({
    dbRoomStatus: dbStatus,
    hasLease,
    studentReservationStatus: studentStatus ?? null,
    manualReservationStatus: manualStatus ?? null,
  });

  await pool.query(
    `UPDATE public.landlord_rooms SET status = $2, updated_at = now() WHERE id = $1::uuid`,
    [roomId, next]
  );
}

/**
 * Keeps student reservation rent status, landlord tenant lease, and room occupancy in sync
 * when a student app payment record is Paid / Pending / Failed.
 */
export async function syncReservationAndLeaseFromStudentPaymentStatus(
  pool: Pool,
  ownerId: string,
  reservationId: string | null,
  paymentRecordStatus: "Paid" | "Pending" | "Failed"
): Promise<void> {
  if (!reservationId) return;

  const rent =
    paymentRecordStatus === "Paid"
      ? "Paid"
      : paymentRecordStatus === "Failed"
        ? "Overdue"
        : "Pending";
  const leasePayment: "Paid" | "Pending" | "Overdue" =
    paymentRecordStatus === "Paid"
      ? "Paid"
      : paymentRecordStatus === "Failed"
        ? "Overdue"
        : "Pending";

  const { rows } = await pool.query<{
    room_id: string;
    property_id: string;
    res_status: string;
    guest_name: string;
    lease_start: Date;
    lease_end: Date;
    student_email: string | null;
    student_user_id: string;
    property_name: string;
    room_no: string;
  }>(
    `SELECT s.room_id, r.property_id, s.status AS res_status, s.guest_name,
            s.lease_start, s.lease_end, u.email AS student_email,
            s.student_user_id, p.name AS property_name, r.room_no
     FROM public.student_dorm_reservations s
     JOIN public.landlord_rooms r ON r.id = s.room_id
     JOIN public.landlord_properties p ON p.id = r.property_id
     JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
     WHERE s.id = $1::uuid AND r.owner_user_id = $2::uuid`,
    [reservationId, ownerId]
  );
  const row = rows[0];
  if (!row) return;

  if (row.res_status === "Cancelled") {
    await pool.query(
      `DELETE FROM public.landlord_tenant_leases WHERE student_reservation_id = $1::uuid`,
      [reservationId]
    );
    await pool.query(
      `UPDATE public.student_dorm_reservations
       SET rent_payment_status = $1, updated_at = now()
       WHERE id = $2::uuid`,
      [rent, reservationId]
    );
    await refreshRoomFromStudentReservations(pool, row.room_id);
    return;
  }

  let resStatus = row.res_status;
  if (leasePayment === "Paid" && row.res_status === "Pending") {
    resStatus = "Confirmed";
  }

  await pool.query(
    `UPDATE public.student_dorm_reservations
     SET rent_payment_status = $1, status = $2, updated_at = now()
     WHERE id = $3::uuid`,
    [rent, resStatus, reservationId]
  );

  await pool.query(
    `INSERT INTO public.landlord_tenant_leases
      (owner_user_id, property_id, room_id, tenant_name, email, phone,
       lease_start, lease_end, payment_status, student_reservation_id)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, NULL, $6::date, $7::date, $8, $9::uuid)
     ON CONFLICT (student_reservation_id) DO UPDATE SET
       tenant_name = EXCLUDED.tenant_name,
       email = EXCLUDED.email,
       lease_start = EXCLUDED.lease_start,
       lease_end = EXCLUDED.lease_end,
       payment_status = EXCLUDED.payment_status,
       updated_at = now()`,
    [
      ownerId,
      row.property_id,
      row.room_id,
      row.guest_name,
      row.student_email,
      row.lease_start,
      row.lease_end,
      leasePayment,
      reservationId,
    ]
  );

  await refreshRoomFromStudentReservations(pool, row.room_id);

  const { reconcileScheduleWithPaidPayments, recomputeReservationBalances } =
    await import("@/lib/payment-schedule");

  if (resStatus === "Confirmed") {
    await reconcileScheduleWithPaidPayments(pool, { reservationId });
    if (paymentRecordStatus !== "Paid") {
      await recomputeReservationBalances(pool, reservationId);
    }
  }

  const dormLabel = `${row.property_name} · Room ${row.room_no}`;
  try {
    const { insertNotification } = await import("@/lib/notify-user");
    if (row.res_status === "Pending" && resStatus === "Confirmed") {
      await insertNotification(
        pool,
        row.student_user_id,
        "Reservation confirmed",
        `Your reservation at ${dormLabel} has been confirmed.`,
        "reservation"
      );
    }
    if (paymentRecordStatus === "Paid") {
      await insertNotification(
        pool,
        row.student_user_id,
        "Payment confirmed",
        `Your payment for ${dormLabel} has been confirmed.`,
        "payment"
      );
    } else if (paymentRecordStatus === "Failed") {
      await insertNotification(
        pool,
        row.student_user_id,
        "Payment not verified",
        `Your payment for ${dormLabel} could not be verified. Contact your landlord or submit again.`,
        "payment"
      );
    }
  } catch {
    /* non-fatal */
  }
}
