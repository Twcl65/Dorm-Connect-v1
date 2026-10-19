import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  fetchMonthlySchedule,
  resolveScheduleTarget,
} from "@/lib/payment-schedule";
import { insertNotification } from "@/lib/notify-user";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const body = (await req.json()) as {
      reservationId?: string;
      leaseId?: string;
      monthNumber?: number;
      message?: string;
    };
    const message = (body.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }
    const monthNumber = Number(body.monthNumber);
    if (!Number.isFinite(monthNumber) || monthNumber < 1) {
      return NextResponse.json(
        { error: "monthNumber is required." },
        { status: 400 }
      );
    }

    const pool = await getPool();
    let studentUserId: string | null = null;
    let tenantLabel = "Tenant";
    let scheduleTarget: { reservationId?: string; leaseId?: string } = {};

    if (body.reservationId && /^[0-9a-f-]{36}$/i.test(body.reservationId)) {
      const { rows } = await pool.query<{
        student_user_id: string;
        tenant_name: string;
      }>(
        `SELECT s.student_user_id,
                COALESCE(NULLIF(trim(u.full_name), ''), s.guest_name) AS tenant_name
         FROM public.student_dorm_reservations s
         JOIN public.landlord_rooms r ON r.id = s.room_id
         JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
         WHERE s.id = $1::uuid AND r.owner_user_id = $2::uuid`,
        [body.reservationId, ownerId]
      );
      if (!rows[0]) {
        return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
      }
      studentUserId = rows[0].student_user_id;
      tenantLabel = rows[0].tenant_name;
      scheduleTarget = { reservationId: body.reservationId };
    } else if (body.leaseId && /^[0-9a-f-]{36}$/i.test(body.leaseId)) {
      const { rows } = await pool.query<{
        student_user_id: string | null;
        tenant_name: string;
        full_name: string | null;
        email: string | null;
      }>(
        `SELECT l.tenant_name, l.email, s.student_user_id, u.full_name
         FROM public.landlord_tenant_leases l
         LEFT JOIN public.student_dorm_reservations s
           ON s.id = l.student_reservation_id
         LEFT JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
         WHERE l.id = $1::uuid AND l.owner_user_id = $2::uuid`,
        [body.leaseId, ownerId]
      );
      if (!rows[0]) {
        return NextResponse.json({ error: "Lease not found." }, { status: 404 });
      }
      studentUserId = rows[0].student_user_id;
      tenantLabel =
        rows[0].full_name?.trim() || rows[0].tenant_name?.trim() || "Tenant";
      if (!studentUserId && rows[0].email) {
        const { rows: u } = await pool.query<{ id: string }>(
          `SELECT id FROM public.boarding_house_app_users
           WHERE lower(email) = lower($1) LIMIT 1`,
          [rows[0].email]
        );
        studentUserId = u[0]?.id ?? null;
      }
      scheduleTarget = { leaseId: body.leaseId };
    } else {
      return NextResponse.json(
        { error: "reservationId or leaseId is required." },
        { status: 400 }
      );
    }

    if (!studentUserId) {
      return NextResponse.json(
        {
          error:
            "This tenant is not linked to a student app account. They cannot receive in-app notifications.",
        },
        { status: 400 }
      );
    }

    const schedule = await fetchMonthlySchedule(pool, scheduleTarget);
    const nextUnpaid = schedule.find((m) => m.status !== "Paid");
    if (!nextUnpaid) {
      return NextResponse.json(
        { error: "All scheduled months are already paid." },
        { status: 400 }
      );
    }
    if (nextUnpaid.monthNumber !== monthNumber) {
      return NextResponse.json(
        {
          error:
            "You can only notify for the current upcoming unpaid month.",
        },
        { status: 400 }
      );
    }
    if (nextUnpaid.reminderSentAt) {
      return NextResponse.json(
        {
          error: "Already notified for this month.",
          alreadyNotified: true,
        },
        { status: 409 }
      );
    }

    const target = await resolveScheduleTarget(pool, scheduleTarget);
    const scheduleId = target.reservationId ?? target.leaseId;
    if (!scheduleId) {
      return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
    }

    const where = target.reservationId
      ? `reservation_id = $1::uuid`
      : `tenant_lease_id = $1::uuid`;

    await insertNotification(
      pool,
      studentUserId,
      "Payment reminder",
      message,
      "payment"
    );

    await pool.query(
      `UPDATE public.payment_due_dates
       SET reminder_sent_at = now(), updated_at = now()
       WHERE ${where} AND month_number = $2`,
      [scheduleId, monthNumber]
    );

    await pool.query(
      `INSERT INTO public.landlord_activity_log (owner_user_id, description)
       VALUES ($1::uuid, $2)`,
      [ownerId, `Notified ${tenantLabel} about payment (month ${monthNumber})`]
    );

    return NextResponse.json({ ok: true, monthNumber });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send notification";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
