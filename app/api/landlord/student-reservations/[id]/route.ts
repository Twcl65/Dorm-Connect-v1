import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  landlordLog,
  refreshRoomFromStudentReservations,
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
      rentPaymentStatus?: string;
      paymentMethod?: string;
      amountPaid?: number;
      referenceNo?: string;
      proofUrl?: string;
    };

    const pool = await getPool();
    const { rows: cur } = await pool.query<{
      room_id: string;
      student_user_id: string;
      status: string;
      rent_payment_status: string;
      guest_name: string;
    }>(
      `SELECT s.room_id, s.student_user_id, s.status, s.rent_payment_status, s.guest_name
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       WHERE s.id = $1::uuid AND r.owner_user_id = $2::uuid`,
      [id, ownerId]
    );
    if (!cur[0]) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const row = cur[0];

    let status = row.status;
    if (
      body.status === "Confirmed" ||
      body.status === "Pending" ||
      body.status === "Cancelled"
    ) {
      status = body.status;
    }

    let rentPaymentStatus = row.rent_payment_status;
    if (
      body.rentPaymentStatus === "Paid" ||
      body.rentPaymentStatus === "Pending" ||
      body.rentPaymentStatus === "Overdue"
    ) {
      rentPaymentStatus = body.rentPaymentStatus;
    }

    const amountPaid =
      body.amountPaid != null ? Math.max(0, Number(body.amountPaid)) : 0;
    const methodRaw = (body.paymentMethod ?? "").trim() || "GCash";
    const method =
      methodRaw === "GCash" ||
      methodRaw === "Cash" ||
      methodRaw === "Bank Transfer"
        ? methodRaw
        : "GCash";

    if (amountPaid > 0 && status === "Confirmed") {
      rentPaymentStatus = "Paid";
      const ref = (body.referenceNo ?? "").trim() || null;
      const proof = (body.proofUrl ?? "").trim() || null;
      await pool.query(
        `INSERT INTO public.student_payment_records
          (student_user_id, reservation_id, amount, method, status, paid_at, receipt_url, description)
         VALUES ($1::uuid, $2::uuid, $3, $4, 'Paid', now(), $5, $6)`,
        [
          row.student_user_id,
          id,
          amountPaid,
          method,
          proof,
          ref ? `Ref: ${ref}` : "Recorded by landlord",
        ]
      );
    }

    await pool.query(
      `UPDATE public.student_dorm_reservations
       SET status = $1, rent_payment_status = $2, updated_at = now()
       WHERE id = $3::uuid`,
      [status, rentPaymentStatus, id]
    );

    await refreshRoomFromStudentReservations(pool, row.room_id);
    await landlordLog(
      pool,
      ownerId,
      `Student reservation ${row.guest_name} → ${status} (rent ${rentPaymentStatus})`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
