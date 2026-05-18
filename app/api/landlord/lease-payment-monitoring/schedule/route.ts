import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { setScheduleMonthStatus } from "@/lib/payment-schedule";
import { insertNotification } from "@/lib/notify-user";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      reservationId?: string;
      leaseId?: string;
      monthNumber?: number;
      status?: string;
      paidOn?: string | null;
    };

    const monthNumber = Number(body.monthNumber);
    if (!Number.isInteger(monthNumber) || monthNumber < 1) {
      return NextResponse.json({ error: "Invalid month." }, { status: 400 });
    }

    const status =
      body.status === "Paid" || body.status === "Not Yet Paid"
        ? body.status
        : null;
    if (!status) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
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

    await setScheduleMonthStatus(pool, {
      reservationId,
      leaseId,
      monthNumber,
      status,
      paidOn: body.paidOn ?? null,
    });

    if (status === "Paid" && reservationId) {
      try {
        const { rows: stuRows } = await pool.query<{
          student_user_id: string;
          property_name: string;
          room_no: string;
        }>(
          `SELECT s.student_user_id, p.name AS property_name, r.room_no
           FROM public.student_dorm_reservations s
           JOIN public.landlord_rooms r ON r.id = s.room_id
           JOIN public.landlord_properties p ON p.id = r.property_id
           WHERE s.id = $1::uuid`,
          [reservationId]
        );
        const stu = stuRows[0];
        if (stu?.student_user_id) {
          await insertNotification(
            pool,
            stu.student_user_id,
            "Payment confirmed",
            `Month ${monthNumber} rent for ${stu.property_name} · Room ${stu.room_no} has been marked as paid.`,
            "payment"
          );
        }
      } catch {
        /* non-fatal */
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
