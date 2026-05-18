import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { landlordLog, refreshRoomFromStudentReservations } from "@/lib/landlord-db";
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
      paymentMethod?: string;
      amountPaid?: number;
      referenceNo?: string;
      proofUrl?: string;
    };

    const pool = await getPool();
    const { rows: cur } = await pool.query<{
      status: string;
      payment_method: string | null;
      amount_paid: string;
      reference_no: string | null;
      proof_url: string | null;
      guest_name: string;
      room_id: string | null;
    }>(
      `SELECT status, payment_method, amount_paid::text, reference_no, proof_url, guest_name, room_id
       FROM public.landlord_reservations
       WHERE owner_user_id = $1::uuid AND id = $2::uuid`,
      [ownerId, id]
    );
    if (!cur[0]) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const c = cur[0];
    let status = c.status;
    if (
      body.status === "Confirmed" ||
      body.status === "Pending" ||
      body.status === "Cancelled"
    ) {
      status = body.status;
    }
    const paymentMethod =
      body.paymentMethod !== undefined
        ? body.paymentMethod.trim() || null
        : c.payment_method;
    const amountPaid =
      body.amountPaid != null ? Math.max(0, Number(body.amountPaid)) : Number(c.amount_paid);
    const referenceNo =
      body.referenceNo !== undefined
        ? body.referenceNo.trim() || null
        : c.reference_no;
    const proofUrl =
      body.proofUrl !== undefined ? body.proofUrl.trim() || null : c.proof_url;

    await pool.query(
      `UPDATE public.landlord_reservations SET
        status = $1,
        payment_method = $2,
        amount_paid = $3,
        reference_no = $4,
        proof_url = $5,
        updated_at = now()
       WHERE owner_user_id = $6::uuid AND id = $7::uuid`,
      [
        status,
        paymentMethod,
        amountPaid,
        referenceNo,
        proofUrl,
        ownerId,
        id,
      ]
    );
    if (c.room_id) {
      await refreshRoomFromStudentReservations(pool, c.room_id);
    }
    await landlordLog(
      pool,
      ownerId,
      `Updated reservation for ${c.guest_name} → ${status}`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
