import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
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
      message?: string;
    };
    const message = (body.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const pool = await getPool();
    let studentUserId: string | null = null;
    let tenantLabel = "Tenant";

    if (body.reservationId && /^[0-9a-f-]{36}$/i.test(body.reservationId)) {
      const { rows } = await pool.query<{
        student_user_id: string;
        guest_name: string;
      }>(
        `SELECT s.student_user_id, s.guest_name
         FROM public.student_dorm_reservations s
         JOIN public.landlord_rooms r ON r.id = s.room_id
         WHERE s.id = $1::uuid AND r.owner_user_id = $2::uuid`,
        [body.reservationId, ownerId]
      );
      if (!rows[0]) {
        return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
      }
      studentUserId = rows[0].student_user_id;
      tenantLabel = rows[0].guest_name;
    } else if (body.leaseId && /^[0-9a-f-]{36}$/i.test(body.leaseId)) {
      const { rows } = await pool.query<{
        student_user_id: string | null;
        tenant_name: string;
        email: string | null;
      }>(
        `SELECT l.tenant_name, l.email, s.student_user_id
         FROM public.landlord_tenant_leases l
         LEFT JOIN public.student_dorm_reservations s
           ON s.id = l.student_reservation_id
         WHERE l.id = $1::uuid AND l.owner_user_id = $2::uuid`,
        [body.leaseId, ownerId]
      );
      if (!rows[0]) {
        return NextResponse.json({ error: "Lease not found." }, { status: 404 });
      }
      studentUserId = rows[0].student_user_id;
      tenantLabel = rows[0].tenant_name;
      if (!studentUserId && rows[0].email) {
        const { rows: u } = await pool.query<{ id: string }>(
          `SELECT id FROM public.boarding_house_app_users
           WHERE lower(email) = lower($1) LIMIT 1`,
          [rows[0].email]
        );
        studentUserId = u[0]?.id ?? null;
      }
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

    await insertNotification(
      pool,
      studentUserId,
      "Payment reminder",
      message,
      "payment"
    );

    await pool.query(
      `INSERT INTO public.landlord_activity_log (owner_user_id, description)
       VALUES ($1::uuid, $2)`,
      [ownerId, `Notified ${tenantLabel} about payment`]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send notification";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
