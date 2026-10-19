import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();
    const { rows } = await pool.query<
      {
        id: string;
        created_at: Date;
        reservation_id: string;
        student_user_id: string;
        tenant_name: string;
        room_id: string;
        room_no: string;
        property_id: string;
        property_name: string;
        lease_start: string;
        lease_end: string;
        move_out_date: string;
        status: string;
        rent_payment_status: string;
        advance_amount: string;
        deposit_amount: string;
        balance_remaining: string;
        ended_by: string;
        ended_reason: string;
      }
    >(
      `SELECT h.id, h.created_at,
              h.reservation_id, h.student_user_id, h.tenant_name,
              h.room_id, r.room_no, h.property_id, p.name AS property_name,
              h.lease_start::text, h.lease_end::text, h.move_out_date::text,
              h.status, h.rent_payment_status,
              h.advance_amount::text, h.deposit_amount::text, h.balance_remaining::text,
              h.ended_by, h.ended_reason
       FROM public.student_reservation_history h
       JOIN public.landlord_rooms r ON r.id = h.room_id
       JOIN public.landlord_properties p ON p.id = h.property_id
       WHERE r.owner_user_id = $1::uuid
       ORDER BY h.created_at DESC`,
      [ownerId]
    );

    return NextResponse.json({
      history: rows.map((r) => ({
        id: r.id,
        reservationId: r.reservation_id,
        studentUserId: r.student_user_id,
        tenantName: r.tenant_name,
        roomNo: r.room_no,
        propertyName: r.property_name,
        leaseStart: r.lease_start,
        leaseEnd: r.lease_end,
        moveOutDate: r.move_out_date,
        status: r.status,
        rentPaymentStatus: r.rent_payment_status,
        advanceAmount: Number(r.advance_amount),
        depositAmount: Number(r.deposit_amount),
        balanceRemaining: Number(r.balance_remaining),
        endedBy: r.ended_by,
        endedReason: r.ended_reason,
        endedAt: r.created_at.toISOString(),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load history";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
