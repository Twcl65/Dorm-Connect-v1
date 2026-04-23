import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";
import {
  formatLeasePeriod,
  reservationLifecycle,
} from "@/lib/student-db";

export const dynamic = "force-dynamic";

function mapRentPayment(
  s: string
): "Paid" | "Pending" | "Overdue" {
  if (s === "Paid") return "Paid";
  if (s === "Overdue") return "Overdue";
  return "Pending";
}

export async function GET() {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      id: string;
      property_name: string;
      room_no: string;
      lease_start: string;
      lease_end: string;
      status: string;
      rent_payment_status: string;
      monthly_rent: string;
    }>(
      `SELECT s.id, p.name AS property_name, r.room_no,
              s.lease_start::text, s.lease_end::text, s.status, s.rent_payment_status,
              s.monthly_rent::text
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE s.student_user_id = $1::uuid
       ORDER BY s.created_at DESC`,
      [studentId]
    );

    const now = new Date();
    const reservations = rows.map((x) => {
      const ls = new Date(x.lease_start);
      const le = new Date(x.lease_end);
      const reservationStatus = reservationLifecycle(x.status, le, now);
      return {
        id: x.id,
        dormName: x.property_name,
        roomNo: x.room_no,
        leasePeriod: formatLeasePeriod(ls, le),
        reservationStatus,
        paymentStatus: mapRentPayment(x.rent_payment_status),
        monthlyRent: Number(x.monthly_rent),
      };
    });

    const activeReservation =
      reservations.find((r) => r.reservationStatus === "Active") ??
      reservations.find((r) => r.reservationStatus === "Pending") ??
      null;

    const { rows: appPayRows } = await pool.query<{
      amount: string;
      status: string;
      paid_at: Date | null;
      created_at: Date;
    }>(
      `SELECT amount::text, status, paid_at, created_at
       FROM public.student_payment_records
       WHERE student_user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 1`,
      [studentId]
    );

    const { rows: landlordPayRows } = await pool.query<{
      amount: string;
      status: string;
      paid_on: string | null;
      created_at: Date;
    }>(
      `SELECT lp.amount::text, lp.status, lp.paid_on::text, lp.created_at
       FROM public.landlord_payments lp
       JOIN public.landlord_rooms r ON r.id = lp.room_id
       JOIN public.student_dorm_reservations s ON s.room_id = r.id
         AND s.student_user_id = $1::uuid
         AND s.status IN ('Pending', 'Confirmed')
       JOIN public.boarding_house_app_users stu ON stu.id = s.student_user_id
       WHERE lower(trim(lp.payer_name)) = lower(trim(stu.full_name))
       ORDER BY COALESCE(lp.paid_on::date, lp.created_at::date) DESC, lp.created_at DESC
       LIMIT 1`,
      [studentId]
    );

    const app = appPayRows[0];
    const lp = landlordPayRows[0];

    const appTs = app
      ? (app.paid_at ?? app.created_at).getTime()
      : -1;
    const lpTs = lp
      ? lp.paid_on?.trim()
        ? new Date(`${lp.paid_on.trim().slice(0, 10)}T12:00:00`).getTime()
        : new Date(lp.created_at).getTime()
      : -1;

    let latestPayment: {
      amount: number;
      status: string;
      paidAtLabel: string | null;
      source: "student_app" | "landlord_entry";
    } | null = null;

    if (app && lp) {
      if (appTs >= lpTs) {
        latestPayment = {
          amount: Number(app.amount),
          status: app.status,
          paidAtLabel: app.paid_at
            ? new Date(app.paid_at).toLocaleString()
            : null,
          source: "student_app",
        };
      } else {
        const paidOn = lp.paid_on?.trim()?.slice(0, 10);
        latestPayment = {
          amount: Number(lp.amount),
          status: lp.status,
          paidAtLabel: paidOn
            ? new Date(`${paidOn}T12:00:00`).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : `Recorded ${new Date(lp.created_at).toLocaleString()}`,
          source: "landlord_entry",
        };
      }
    } else if (app) {
      latestPayment = {
        amount: Number(app.amount),
        status: app.status,
        paidAtLabel: app.paid_at
          ? new Date(app.paid_at).toLocaleString()
          : null,
        source: "student_app",
      };
    } else if (lp) {
      const paidOn = lp.paid_on?.trim()?.slice(0, 10);
      latestPayment = {
        amount: Number(lp.amount),
        status: lp.status,
        paidAtLabel: paidOn
          ? new Date(`${paidOn}T12:00:00`).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : `Recorded ${new Date(lp.created_at).toLocaleString()}`,
        source: "landlord_entry",
      };
    }

    return NextResponse.json({
      reservations,
      activeReservation,
      latestPayment,
      paymentHint:
        "Pay through the Payments page or follow your landlord’s instructions.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load overview";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
