import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";
import { formatLeasePeriod } from "@/lib/student-db";
import { syncReservationAndLeaseFromStudentPaymentStatus } from "@/lib/landlord-db";

export const dynamic = "force-dynamic";

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
      amount: string;
      method: string;
      status: string;
      created_at: Date;
      paid_at: Date | null;
      receipt_url: string | null;
      reservation_id: string | null;
      property_name: string | null;
      room_no: string | null;
      lease_start: string | null;
      lease_end: string | null;
      monthly_rent: string | null;
      landlord_name: string | null;
      listing_location: string | null;
      property_address: string | null;
      property_city: string | null;
    }>(
      `SELECT pay.id, pay.amount::text, pay.method, pay.status, pay.created_at, pay.paid_at,
              pay.receipt_url, pay.reservation_id,
              p.name AS property_name, r.room_no,
              s.lease_start::text AS lease_start, s.lease_end::text AS lease_end,
              s.monthly_rent::text AS monthly_rent,
              u.full_name AS landlord_name,
              r.listing_location, p.address AS property_address, p.city AS property_city
       FROM public.student_payment_records pay
       LEFT JOIN public.student_dorm_reservations s ON s.id = pay.reservation_id
       LEFT JOIN public.landlord_rooms r ON r.id = s.room_id
       LEFT JOIN public.landlord_properties p ON p.id = r.property_id
       LEFT JOIN public.boarding_house_app_users u ON u.id = r.owner_user_id
       WHERE pay.student_user_id = $1::uuid
       ORDER BY pay.created_at DESC`,
      [studentId]
    );

    const payments = rows.map((x) => {
      const leasePeriod =
        x.lease_start && x.lease_end
          ? formatLeasePeriod(new Date(x.lease_start), new Date(x.lease_end))
          : "—";
      const months =
        x.lease_start && x.lease_end
          ? Math.max(
              1,
              Math.round(
                (new Date(x.lease_end).getTime() -
                  new Date(x.lease_start).getTime()) /
                  (30.44 * 24 * 60 * 60 * 1000)
              )
            )
          : 12;
      const location =
        x.listing_location?.trim() ||
        [x.property_address, x.property_city].filter(Boolean).join(", ") ||
        "—";
      return {
        id: x.id,
        dormName: x.property_name ?? "General payment",
        roomNo: x.room_no ?? "—",
        amount: Number(x.amount),
        method: x.method,
        status: x.status as "Paid" | "Pending" | "Failed",
        date: new Date(x.created_at).toISOString().slice(0, 10),
        moveInDate: x.lease_start?.slice(0, 10) ?? "—",
        leaseMonths: months,
        monthlyRent: x.monthly_rent ? Number(x.monthly_rent) : 0,
        location,
        landlord: x.landlord_name ?? "—",
        distance: "—",
        documentType: "—",
        images: [] as string[],
        receiptUrl: x.receipt_url ?? undefined,
        paidAt: x.paid_at
          ? new Date(x.paid_at).toLocaleString()
          : undefined,
        leasePeriod,
      };
    });

    return NextResponse.json({ payments });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load payments";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;

  try {
    const body = (await req.json()) as {
      reservationId?: string | null;
      amount?: number;
      method?: string;
      status?: string;
      receiptUrl?: string;
      description?: string;
      paidAt?: string;
    };
    const amount = Math.max(0, Number(body.amount) || 0);
    if (amount <= 0) {
      return NextResponse.json({ error: "Amount is required." }, { status: 400 });
    }
    const method = (body.method ?? "GCash").trim() || "GCash";
    const status =
      body.status === "Paid" || body.status === "Failed"
        ? body.status
        : "Pending";
    const reservationId =
      body.reservationId && /^[0-9a-f-]{36}$/i.test(body.reservationId)
        ? body.reservationId
        : null;

    const pool = await getPool();
    if (reservationId) {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM public.student_dorm_reservations
         WHERE id = $1::uuid AND student_user_id = $2::uuid`,
        [reservationId, studentId]
      );
      if (!rows[0]) {
        return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
      }
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.student_payment_records
        (student_user_id, reservation_id, amount, method, status, paid_at, receipt_url, description)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz, $7, $8)
       RETURNING id`,
      [
        studentId,
        reservationId,
        amount,
        method,
        status,
        body.paidAt ? new Date(body.paidAt).toISOString() : null,
        (body.receiptUrl ?? "").trim() || null,
        (body.description ?? "").trim() || null,
      ]
    );

    if (reservationId) {
      const { rows: ownRows } = await pool.query<{ owner_user_id: string }>(
        `SELECT r.owner_user_id
         FROM public.student_dorm_reservations s
         JOIN public.landlord_rooms r ON r.id = s.room_id
         WHERE s.id = $1::uuid AND s.student_user_id = $2::uuid`,
        [reservationId, studentId]
      );
      const ownerUserId = ownRows[0]?.owner_user_id;
      if (ownerUserId) {
        await syncReservationAndLeaseFromStudentPaymentStatus(
          pool,
          ownerUserId,
          reservationId,
          status as "Paid" | "Pending" | "Failed"
        );
      }
    }

    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to record payment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
