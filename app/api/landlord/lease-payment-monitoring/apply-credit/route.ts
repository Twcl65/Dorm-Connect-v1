import { NextResponse } from "next/server";
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

    if (reservationId) {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT s.id
         FROM public.student_dorm_reservations s
         JOIN public.landlord_rooms r ON r.id = s.room_id
         WHERE s.id = $1::uuid AND r.owner_user_id = $2::uuid`,
        [reservationId, ownerId]
      );
      if (!rows[0]) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
    } else if (leaseId) {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM public.landlord_tenant_leases
         WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
        [leaseId, ownerId]
      );
      if (!rows[0]) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
    }

    const balances = await applyScheduleCreditForMonth(pool, {
      reservationId,
      leaseId,
      monthNumber,
      fundSource,
      paidOn: body.paidOn ?? null,
    });

    return NextResponse.json({ ok: true, ...balances });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to apply credit";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
