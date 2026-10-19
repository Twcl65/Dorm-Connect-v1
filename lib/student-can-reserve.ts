import type { Pool } from "pg";

export type StudentReserveGate = { ok: true } | { ok: false; reason: string };

export async function assertStudentCanReserve(
  pool: Pool,
  studentUserId: string
): Promise<StudentReserveGate> {
  const { rows: u } = await pool.query<{
    ict_verification_status: string;
  }>(
    `SELECT ict_verification_status FROM public.boarding_house_app_users
     WHERE id = $1::uuid AND role = 'Student'`,
    [studentUserId]
  );
  const row = u[0];
  if (!row) {
    return { ok: false, reason: "Student account not found." };
  }
  if (row.ict_verification_status === "Pending Verification") {
    return {
      ok: false,
      reason:
        "Your account is pending ICT verification. You can browse listings, but booking is available only after verification.",
    };
  }
  if (row.ict_verification_status === "Rejected") {
    return {
      ok: false,
      reason:
        "Your registration was not approved by ICT. You cannot reserve a room.",
    };
  }

  const { rows: debt } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM public.student_dorm_reservations s
     WHERE s.student_user_id = $1::uuid
       AND s.status = 'Confirmed'
       AND (
         s.rent_payment_status IN ('Pending', 'Overdue')
         OR COALESCE(s.balance_remaining, 0) > 0
       )`,
    [studentUserId]
  );
  if (Number(debt[0]?.n ?? 0) > 0) {
    return {
      ok: false,
      reason:
        "You have an unpaid balance on a confirmed stay. Pay outstanding amounts before reserving another property.",
    };
  }

  return { ok: true };
}
