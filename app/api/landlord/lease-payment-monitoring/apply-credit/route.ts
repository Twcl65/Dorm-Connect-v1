import { NextResponse } from "next/server";
import { invalidateLandlordUser, invalidateStudentUser } from "@/lib/api-cache";
import { getPool } from "@/lib/db";
import { applyScheduleCreditForMonth } from "@/lib/payment-schedule";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      reservationId?: string;
      leaseId?: string;
      monthNumber?: number;
      fundSource?: string;
      paidOn?: string | null;
    };

    const monthNumber = Number(body.monthNumber);
    if (!Number.isInteger(monthNumber) || monthNumber < 1) {
      return NextResponse.json({ error: "Invalid month." }, { status: 400 });
    }

    const fundSource =
      body.fundSource === "advance" || body.fundSource === "deposit"
        ? body.fundSource
        : null;
    if (!fundSource) {
      return NextResponse.json({ error: "Invalid fund source." }, { status: 400 });
    }

    const reservationId = body.reservationId?.trim() || null;
    const leaseId = body.leaseId?.trim() || null;
    if (!reservationId && !leaseId) {
      return NextResponse.json(
        { error: "Reservation or lease id is required." },
        { status: 400 }
      );
    }

    const pool = await getPool();
    const ownerId = session.sub;
    let studentUserId: string | null = null;

    if (reservationId) {
      const { rows } = await pool.query<{ id: string; student_user_id: string }>(
        `SELECT s.id, s.student_user_id
         FROM public.student_dorm_reservations s
         JOIN public.landlord_rooms r ON r.id = s.room_id
         WHERE s.id = $1::uuid AND r.owner_user_id = $2::uuid`,
        [reservationId, ownerId]
      );
      if (!rows[0]) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      studentUserId = rows[0].student_user_id;
    } else if (leaseId) {
      const { rows } = await pool.query<{ id: string; student_user_id: string | null }>(
        `SELECT l.id, s.student_user_id
         FROM public.landlord_tenant_leases l
         LEFT JOIN public.student_dorm_reservations s
           ON s.id = l.student_reservation_id
         WHERE l.id = $1::uuid AND l.owner_user_id = $2::uuid`,
        [leaseId, ownerId]
      );
      if (!rows[0]) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      studentUserId = rows[0].student_user_id;
    }

    const balances = await applyScheduleCreditForMonth(pool, {
      reservationId,
      leaseId,
      monthNumber,
      fundSource,
      paidOn: body.paidOn ?? null,
    });

    invalidateLandlordUser(ownerId);
    if (studentUserId) invalidateStudentUser(studentUserId);

    return NextResponse.json({ ok: true, ...balances });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to apply credit";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
