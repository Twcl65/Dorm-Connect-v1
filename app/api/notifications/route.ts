import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  deriveTenantPaymentStatusFromSchedule,
  fetchMonthlySchedule,
} from "@/lib/payment-schedule";
import { getSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

type ApiNotification = {
  id: string;
  category: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  synthetic: boolean;
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      id: string;
      category: string;
      title: string;
      body: string;
      read_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, category, title, body, read_at, created_at
       FROM public.app_notifications
       WHERE user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 100`,
      [session.sub]
    );

    const notifications: ApiNotification[] = rows.map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      body: r.body,
      read: r.read_at != null,
      createdAt: r.created_at.toISOString(),
      synthetic: false,
    }));

    if (session.role === "Landlord") {
      const { rows: expRows } = await pool.query<{
        id: string;
        dorm_name: string;
        accreditation_expires_at: Date | null;
      }>(
        `SELECT a.id, a.dorm_name, a.accreditation_expires_at
         FROM public.landlord_accreditation_requests a
         WHERE a.owner_user_id = $1::uuid
           AND a.status = 'Approved'
           AND a.accreditation_expires_at IS NOT NULL`,
        [session.sub]
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (const a of expRows) {
        if (!a.accreditation_expires_at) continue;
        const exp = new Date(a.accreditation_expires_at);
        exp.setHours(0, 0, 0, 0);
        const diff = Math.round(
          (exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
        );
        if (diff >= 0 && diff <= 31) {
          notifications.unshift({
            id: `synthetic-renewal-${a.id}`,
            category: "accreditation",
            title: "Accreditation renewal",
            body: `Accreditation for “${a.dorm_name}” expires on ${exp.toISOString().slice(0, 10)}. Plan renewal with OSA.`,
            read: false,
            createdAt: new Date().toISOString(),
            synthetic: true,
          });
        }
      }
    }

    if (session.role === "Student") {
      const { rows: dueRows } = await pool.query<{
        id: string;
        next_payment_due_date: Date | null;
        balance_remaining: string | null;
        dorm: string;
      }>(
        `SELECT s.id, s.next_payment_due_date, s.balance_remaining::text,
                p.name AS dorm
         FROM public.student_dorm_reservations s
         JOIN public.landlord_rooms r ON r.id = s.room_id
         JOIN public.landlord_properties p ON p.id = r.property_id
         WHERE s.student_user_id = $1::uuid
           AND s.status = 'Confirmed'
           AND s.next_payment_due_date IS NOT NULL`,
        [session.sub]
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (const d of dueRows) {
        const schedule = await fetchMonthlySchedule(pool, {
          reservationId: d.id,
        });
        if (schedule.length > 0) {
          const monthStatus = deriveTenantPaymentStatusFromSchedule(
            schedule,
            "Pending"
          );
          if (monthStatus === "Paid") continue;
        }

        if (!d.next_payment_due_date) continue;
        const due = new Date(d.next_payment_due_date);
        due.setHours(0, 0, 0, 0);
        const diff = Math.round(
          (due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
        );
        const bal = Number(d.balance_remaining ?? 0);
        if (bal <= 0 && diff > 0) continue;
        if (diff === 3 || diff === 2 || diff === 1) {
          notifications.unshift({
            id: `synthetic-due-${d.id}`,
            category: "payment",
            title: "Rent due soon",
            body: `Payment for ${d.dorm} is due on ${due.toISOString().slice(0, 10)}.`,
            read: false,
            createdAt: new Date().toISOString(),
            synthetic: true,
          });
        } else if (diff < 0 && bal > 0) {
          notifications.unshift({
            id: `synthetic-overdue-${d.id}`,
            category: "payment",
            title: "Overdue payment",
            body: `Balance for ${d.dorm} was due ${due.toISOString().slice(0, 10)}. Please settle with your landlord.`,
            read: false,
            createdAt: new Date().toISOString(),
            synthetic: true,
          });
        }
      }
    }

    return NextResponse.json({ notifications });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { id?: string; markAllRead?: boolean };
    const pool = await getPool();

    if (body.markAllRead) {
      await pool.query(
        `UPDATE public.app_notifications
         SET read_at = now()
         WHERE user_id = $1::uuid AND read_at IS NULL`,
        [session.sub]
      );
      return NextResponse.json({ ok: true });
    }

    const id = (body.id ?? "").trim();
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid notification id." }, { status: 400 });
    }

    await pool.query(
      `UPDATE public.app_notifications
       SET read_at = now()
       WHERE id = $1::uuid AND user_id = $2::uuid`,
      [id, session.sub]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
