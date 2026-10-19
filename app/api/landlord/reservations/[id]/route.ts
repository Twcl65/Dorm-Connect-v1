import { NextResponse } from "next/server";
import { invalidateLandlordUser } from "@/lib/api-cache";
import { getPool } from "@/lib/db";
import { landlordLog, refreshRoomFromStudentReservations } from "@/lib/landlord-db";
import { requireOwner } from "@/lib/require-owner";
import { insertNotification } from "@/lib/notify-user";

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
      notes?: string;
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
      room_no: string | null;
      property_id: string | null;
      lease_start: string | null;
      lease_end: string | null;
      property_name: string;
    }>(
      `SELECT r.status, r.payment_method, r.amount_paid::text, r.reference_no, r.proof_url, r.guest_name, r.room_id, r.room_no, r.property_id, r.lease_start, r.lease_end, p.name AS property_name
       FROM public.landlord_reservations r
       LEFT JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE r.owner_user_id = $1::uuid AND r.id = $2::uuid`,
      [ownerId, id]
    );
    if (!cur[0]) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const c = cur[0];

    // Check for room conflicts: another student reservation for the same room
    const conflictResolution: { cancelledId?: string; cancelledName?: string } = {};
    if (c.room_id) {
      const { rows: sameRoom } = await pool.query<{
        id: string;
        guest_name: string;
        status: string;
        student_user_id: string | null;
      }>(
        `SELECT s.id, s.guest_name, s.status, s.student_user_id
         FROM public.student_dorm_reservations s
         JOIN public.landlord_rooms r ON r.id = s.room_id
         WHERE r.owner_user_id = $1::uuid
           AND r.id = $2::uuid
           AND s.status IN ('Confirmed', 'Pending')
           AND s.id <> $3::uuid`,
        [ownerId, c.room_id, id]
      );
      if (sameRoom.length > 0) {
        const conflicting = sameRoom.find((s) => s.status === "Confirmed");
        if (conflicting) {
          const { rows: cancelRes } = await pool.query<{ id: string }>(
            `UPDATE public.student_dorm_reservations
             SET status = 'Cancelled',
                 updated_at = now()
             WHERE id = $1::uuid
               AND student_user_id = $2::uuid
             RETURNING id`,
            [conflicting.id, conflicting.student_user_id]
          );
          if (cancelRes[0]) {
            await pool.query(
              `INSERT INTO public.landlord_reservations
                (owner_user_id, property_id, room_id, guest_name, email, contact,
                 lease_start, lease_end, status, payment_method, amount_paid, reference_no, proof_url)
               VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::date, $8::date,
                       'Cancelled', $9, $10, $11, $12)`,
              [
                ownerId,
                c.property_id,
                c.room_id,
                conflicting.guest_name,
                null,
                null,
                c.lease_start,
                c.lease_end,
                c.payment_method,
                0,
                null,
                null,
              ]
            );
            conflictResolution.cancelledId = conflicting.id;
            conflictResolution.cancelledName = conflicting.guest_name;
            // Notify the cancelled student
            try {
              if (conflicting.student_user_id) {
                await insertNotification(
                  pool,
                  conflicting.student_user_id,
                  "Reservation cancelled",
                  `Another student reserved ${c.guest_name}'s room at ${c.property_name} · Room ${c.room_no}. Your reservation has been cancelled.`,
                  "reservation"
                );
              }
            } catch {
              /* non-fatal */
            }
          }
        }
      }
    }
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
    const remarks =
      body.notes !== undefined ? body.notes.trim() || null : undefined;

    await pool.query(
      `UPDATE public.landlord_reservations SET
        status = $1,
        payment_method = $2,
        amount_paid = $3,
        reference_no = $4,
        proof_url = $5,
        notes = CASE WHEN $6::text IS NOT NULL THEN $6::text ELSE notes END,
        updated_at = now()
       WHERE owner_user_id = $7::uuid AND id = $8::uuid`,
      [
        status,
        paymentMethod,
        amountPaid,
        referenceNo,
        proofUrl,
        remarks,
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
    invalidateLandlordUser(ownerId);
    return NextResponse.json({
      ok: true,
      conflictResolution,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
