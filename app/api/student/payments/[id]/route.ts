import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";
import { formatLeasePeriod } from "@/lib/student-db";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  context: { params: { id: string } }
) {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;
  const rawId = context.params.id;
  if (!rawId || typeof rawId !== "string") {
    return NextResponse.json({ error: "Invalid payment id." }, { status: 400 });
  }

  const isLandlordEntry = rawId.startsWith("lp-");
  const id = isLandlordEntry ? rawId.slice(3) : rawId;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid payment id." }, { status: 400 });
  }

  try {
    const pool = await getPool();

    if (isLandlordEntry) {
      const { rows } = await pool.query<{
        id: string;
        amount: string;
        method: string;
        status: string;
        created_at: Date;
        paid_on: string | null;
        proof_url: string | null;
        reference_no: string | null;
        property_name: string | null;
        room_no: string | null;
        lease_start: string | null;
        lease_end: string | null;
        monthly_rent: string | null;
        landlord_name: string | null;
        student_name: string;
        description: string | null;
      }>(
        `SELECT lp.id, lp.amount::text, lp.method, lp.status, lp.created_at,
                lp.paid_on::text, lp.proof_url, lp.reference_no,
                p.name AS property_name, r.room_no,
                s.lease_start::text AS lease_start, s.lease_end::text AS lease_end,
                s.monthly_rent::text,
                u.full_name AS landlord_name,
                st.full_name AS student_name,
                NULL::text AS description
         FROM public.landlord_payments lp
         JOIN public.landlord_rooms r ON r.id = lp.room_id
         JOIN public.landlord_properties p ON p.id = r.property_id
         JOIN public.boarding_house_app_users u ON u.id = r.owner_user_id
         JOIN public.student_dorm_reservations s ON s.room_id = r.id
           AND s.student_user_id = $1::uuid
           AND s.status IN ('Pending', 'Confirmed')
         JOIN public.boarding_house_app_users st ON st.id = s.student_user_id
         WHERE lp.id = $2::uuid
           AND lower(trim(lp.payer_name)) = lower(trim(st.full_name))`,
        [studentId, id]
      );
      const x = rows[0];
      if (!x) {
        return NextResponse.json({ error: "Payment not found." }, { status: 404 });
      }
      const leasePeriod =
        x.lease_start && x.lease_end
          ? formatLeasePeriod(new Date(x.lease_start), new Date(x.lease_end))
          : "—";
      const amountNum = Number(x.amount);
      const monthlyRent = x.monthly_rent ? Number(x.monthly_rent) : 0;
      const expectedInitial = monthlyRent > 0 ? monthlyRent * 3 : 0;
      const isInitialBundle =
        monthlyRent > 0 && Math.abs(amountNum - expectedInitial) < 0.005;
      const lineItems = isInitialBundle
        ? [
            { label: "First month rent", amount: monthlyRent },
            { label: "Advance payment (1 month)", amount: monthlyRent },
            {
              label: "Security deposit (refundable at end of lease)",
              amount: monthlyRent,
            },
          ]
        : null;
      const notes =
        x.reference_no?.trim() ||
        "Recorded by your landlord (onsite / manual entry).";

      const paidAtIso = x.paid_on?.trim()
        ? new Date(`${x.paid_on.trim().slice(0, 10)}T12:00:00`).toISOString()
        : null;

      return NextResponse.json({
        payment: {
          id: rawId,
          amount: amountNum,
          method: x.method,
          status: x.status,
          createdAt: new Date(x.created_at).toISOString(),
          paidAt: paidAtIso,
          receiptUrl: null as string | null,
          proofImageUrl: x.proof_url ?? null,
          dormName: x.property_name ?? "General payment",
          roomNo: x.room_no ?? "—",
          landlord: x.landlord_name ?? "—",
          leasePeriod,
          studentName: x.student_name,
          monthlyRent: monthlyRent > 0 ? monthlyRent : null,
          lineItems,
          notes,
          source: "landlord_entry" as const,
        },
      });
    }

    const { rows } = await pool.query<{
      id: string;
      amount: string;
      method: string;
      status: string;
      created_at: Date;
      paid_at: Date | null;
      receipt_url: string | null;
      proof_image_url: string | null;
      reservation_id: string | null;
      property_name: string | null;
      room_no: string | null;
      lease_start: string | null;
      lease_end: string | null;
      monthly_rent: string | null;
      landlord_name: string | null;
      student_name: string;
      description: string | null;
    }>(
      `SELECT pay.id, pay.amount::text, pay.method, pay.status, pay.created_at, pay.paid_at,
              pay.receipt_url, pay.proof_image_url, pay.reservation_id, pay.description,
              p.name AS property_name, r.room_no,
              s.lease_start::text AS lease_start, s.lease_end::text AS lease_end,
              s.monthly_rent::text,
              u.full_name AS landlord_name,
              st.full_name AS student_name
       FROM public.student_payment_records pay
       LEFT JOIN public.student_dorm_reservations s ON s.id = pay.reservation_id
       LEFT JOIN public.landlord_rooms r ON r.id = s.room_id
       LEFT JOIN public.landlord_properties p ON p.id = r.property_id
       LEFT JOIN public.boarding_house_app_users u ON u.id = r.owner_user_id
       JOIN public.boarding_house_app_users st ON st.id = pay.student_user_id
       WHERE pay.id = $1::uuid AND pay.student_user_id = $2::uuid`,
      [id, studentId]
    );
    const x = rows[0];
    if (!x) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }
    const leasePeriod =
      x.lease_start && x.lease_end
        ? formatLeasePeriod(new Date(x.lease_start), new Date(x.lease_end))
        : "—";
    const amountNum = Number(x.amount);
    const monthlyRent = x.monthly_rent ? Number(x.monthly_rent) : 0;
    const expectedInitial = monthlyRent > 0 ? monthlyRent * 3 : 0;
    const isInitialBundle =
      monthlyRent > 0 && Math.abs(amountNum - expectedInitial) < 0.005;
    const lineItems = isInitialBundle
      ? [
          {
            label: "First month rent",
            amount: monthlyRent,
          },
          {
            label: "Advance payment (1 month)",
            amount: monthlyRent,
          },
          {
            label: "Security deposit (refundable at end of lease)",
            amount: monthlyRent,
          },
        ]
      : null;
    const notes = x.description?.trim() || null;

    return NextResponse.json({
      payment: {
        id: x.id,
        amount: amountNum,
        method: x.method,
        status: x.status,
        createdAt: new Date(x.created_at).toISOString(),
        paidAt: x.paid_at ? new Date(x.paid_at).toISOString() : null,
        receiptUrl: x.receipt_url,
        proofImageUrl: x.proof_image_url,
        dormName: x.property_name ?? "General payment",
        roomNo: x.room_no ?? "—",
        landlord: x.landlord_name ?? "—",
        leasePeriod,
        studentName: x.student_name,
        monthlyRent: monthlyRent > 0 ? monthlyRent : null,
        lineItems,
        notes,
        source: "student_app" as const,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load payment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
