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

    const { rows: payRows } = await pool.query<{
      amount: string;
      status: string;
      paid_at: Date | null;
    }>(
      `SELECT amount::text, status, paid_at
       FROM public.student_payment_records
       WHERE student_user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 1`,
      [studentId]
    );
    const latest = payRows[0];
    const latestPayment = latest
      ? {
          amount: Number(latest.amount),
          status: latest.status as "Paid" | "Pending" | "Failed",
          paidAtLabel: latest.paid_at
            ? new Date(latest.paid_at).toLocaleString()
            : null,
        }
      : null;

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
