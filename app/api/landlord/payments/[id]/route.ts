import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { landlordLog } from "@/lib/landlord-db";
import {
  reconcileScheduleWithPaidPayments,
  resolveLeaseIdForRoom,
} from "@/lib/payment-schedule";
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
      payer_name: string;
      amount: string;
      method: string;
      status: string;
      reference_no: string | null;
      proof_url: string | null;
      paid_on: string | null;
      room_id: string | null;
    }>(
      `SELECT payer_name, amount::text, method, status, reference_no, proof_url,
              paid_on::text, room_id
       FROM public.landlord_payments
       WHERE owner_user_id = $1::uuid AND id = $2::uuid`,
      [ownerId, id]
    );
    if (!cur[0]) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const c = cur[0];
    let status = c.status;
    if (
      body.status === "Paid" ||
      body.status === "Pending" ||
      body.status === "Overdue"
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
    const referenceNo =
      body.referenceNo !== undefined
        ? body.referenceNo.trim() || null
        : c.reference_no;
    const proofUrl =
      body.proofUrl !== undefined ? body.proofUrl.trim() || null : c.proof_url;
    const paidOn =
      body.paidOn !== undefined
        ? body.paidOn.slice(0, 10) || null
        : c.paid_on?.slice(0, 10) ?? null;

    await pool.query(
      `UPDATE public.landlord_payments SET
        amount = $1,
        method = $2,
        status = $3,
        reference_no = $4,
        proof_url = $5,
        paid_on = $6::date,
        updated_at = now()
       WHERE owner_user_id = $7::uuid AND id = $8::uuid`,
      [amount, method, status, referenceNo, proofUrl, paidOn, ownerId, id]
    );
    if (status === "Paid" && c.room_id) {
      const leaseId = await resolveLeaseIdForRoom(pool, ownerId, c.room_id);
      if (leaseId) {
        await reconcileScheduleWithPaidPayments(pool, { leaseId });
      }
    }

    await landlordLog(pool, ownerId, `Updated payment ${c.payer_name}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
