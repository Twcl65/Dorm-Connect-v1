import { NextResponse } from "next/server";
import { invalidateLandlordUser, invalidateStudentUser } from "@/lib/api-cache";
import { getPool } from "@/lib/db";
import { requireLandlord } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function POST(req: Request, context: Ctx) {
  const session = await requireLandlord();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: { type?: string; amount?: number };
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    body = parsed as { type?: string; amount?: number };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.type !== "advance" && body.type !== "deposit") {
    return NextResponse.json({ error: "Invalid balance type." }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8
  ) {
    return NextResponse.json(
      { error: "Enter a valid amount greater than zero with at most two decimal places." },
      { status: 400 }
    );
  }

  const balanceColumn =
    body.type === "advance" ? "advance_amount" : "deposit_amount";
  const balanceLabel =
    body.type === "advance" ? "advance payment" : "security deposit";
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      student_user_id: string;
      guest_name: string;
      property_name: string;
      room_no: string;
      status: string;
      current_balance: string;
    }>(
      `SELECT s.student_user_id, s.guest_name, s.status, p.name AS property_name,
              r.room_no, s.${balanceColumn}::text AS current_balance
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE s.id = $1::uuid AND r.owner_user_id = $2::uuid
       FOR UPDATE OF s`,
      [id, session.sub]
    );
    const reservation = rows[0];
    if (!reservation) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
    }
    if (reservation.status !== "Confirmed") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Balance actions are only available for confirmed reservations." },
        { status: 400 }
      );
    }

    const currentBalance = Number(reservation.current_balance) || 0;
    if (amount > currentBalance) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error: `Insufficient ${balanceLabel} balance (₱${currentBalance.toLocaleString()} available).`,
        },
        { status: 400 }
      );
    }

    const nextBalance = Math.round((currentBalance - amount) * 100) / 100;
    await client.query(
      `UPDATE public.student_dorm_reservations
       SET ${balanceColumn} = $1, updated_at = now()
       WHERE id = $2::uuid`,
      [nextBalance, id]
    );
    await client.query(
      `INSERT INTO public.landlord_activity_log (owner_user_id, description)
       VALUES ($1::uuid, $2)`,
      [
        session.sub,
        `Withdrew ₱${amount.toLocaleString()} from ${balanceLabel} for ${reservation.guest_name} · ${reservation.property_name} · Room ${reservation.room_no}`,
      ]
    );
    await client.query("COMMIT");

    invalidateLandlordUser(session.sub);
    invalidateStudentUser(reservation.student_user_id);
    return NextResponse.json({ ok: true, balance: nextBalance });
  } catch (e) {
    await client.query("ROLLBACK");
    const message = e instanceof Error ? e.message : "Failed to withdraw balance.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
