import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  landlordLog,
  syncReservationAndLeaseFromStudentPaymentStatus,
} from "@/lib/landlord-db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, context: Ctx) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      status?: string;
      method?: string;
      amount?: number;
      referenceNo?: string;
      proofUrl?: string;
      paidOn?: string;
    };

    const pool = await getPool();
    const { rows: cur } = await pool.query<{
      student_user_id: string;
      reservation_id: string | null;
      amount: string;
      method: string;
      status: string;
      receipt_url: string | null;
      paid_at: Date | null;
    }>(
      `SELECT pay.student_user_id, pay.reservation_id, pay.amount::text, pay.method, pay.status,
              pay.receipt_url, pay.paid_at
       FROM public.student_payment_records pay
       LEFT JOIN public.student_dorm_reservations s ON s.id = pay.reservation_id
       LEFT JOIN public.landlord_rooms r ON r.id = s.room_id
       WHERE pay.id = $1::uuid AND r.owner_user_id = $2::uuid`,
      [id, ownerId]
    );
    if (!cur[0]) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const c = cur[0];

    let status = c.status;
    if (body.status === "Overdue") {
      status = "Failed";
    } else if (
      body.status === "Paid" ||
      body.status === "Pending" ||
      body.status === "Failed"
    ) {
      status = body.status;
    }
    let method = c.method;
    if (
      body.method === "GCash" ||
      body.method === "Cash" ||
      body.method === "Bank Transfer"
    ) {
      method = body.method;
    }
    const amount =
      body.amount != null ? Math.max(0, Number(body.amount)) : Number(c.amount);
    const receiptUrl =
      body.proofUrl !== undefined
        ? body.proofUrl.trim() || null
        : c.receipt_url;
    const paidAt =
      body.paidOn !== undefined
        ? body.paidOn
          ? new Date(body.paidOn).toISOString()
          : null
        : c.paid_at?.toISOString() ?? null;
    await pool.query(
      `UPDATE public.student_payment_records SET
        amount = $1,
        method = $2,
        status = $3,
        receipt_url = $4,
        paid_at = $5::timestamptz
       WHERE id = $6::uuid`,
      [amount, method, status, receiptUrl, paidAt, id]
    );

    await syncReservationAndLeaseFromStudentPaymentStatus(
      pool,
      ownerId,
      c.reservation_id,
      status as "Paid" | "Pending" | "Failed"
    );

    await landlordLog(pool, ownerId, `Updated student app payment record`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
