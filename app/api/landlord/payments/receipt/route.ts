import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { resolveDormDisplayName } from "@/lib/landlord-db";
import {
  buildInitialPaymentLineItems,
  type PaymentReceiptData,
} from "@/lib/payment-receipt-data";
import { formatLeasePeriod } from "@/lib/student-db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function monthYearLabel(paidOnIso: string | null, createdAt: Date): string {
  const raw = paidOnIso?.slice(0, 10);
  const d = raw ? new Date(`${raw}T12:00:00`) : createdAt;
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export async function GET(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim() ?? "";
  const source = url.searchParams.get("source")?.trim() ?? "landlord";

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid payment id." }, { status: 400 });
  }

  try {
    const pool = await getPool();
    let payment: PaymentReceiptData | null = null;

    if (source === "student") {
      const { rows } = await pool.query<{
        id: string;
        amount: string;
        method: string;
        status: string;
        created_at: Date;
        paid_at: Date | null;
        property_name: string | null;
        room_no: string | null;
        lease_start: string | null;
        lease_end: string | null;
        monthly_rent: string | null;
        landlord_name: string | null;
        student_name: string;
        description: string | null;
        acc_dorm_name: string | null;
        proof_image_url: string | null;
      }>(
        `SELECT pay.id, pay.amount::text, pay.method, pay.status, pay.created_at, pay.paid_at,
                pay.description, pay.proof_image_url,
                p.name AS property_name, r.room_no,
                s.lease_start::text AS lease_start, s.lease_end::text AS lease_end,
                s.monthly_rent::text,
                ul.full_name AS landlord_name,
                st.full_name AS student_name,
                (SELECT a.dorm_name FROM public.landlord_accreditation_requests a
                 WHERE p.id IS NOT NULL
                   AND (a.property_id = p.id OR a.owner_user_id = p.owner_user_id)
                   AND trim(a.dorm_name) <> ''
                 ORDER BY a.submitted_at DESC
                 LIMIT 1) AS acc_dorm_name
         FROM public.student_payment_records pay
         JOIN public.student_dorm_reservations s ON s.id = pay.reservation_id
         JOIN public.landlord_rooms r ON r.id = s.room_id
         LEFT JOIN public.landlord_properties p ON p.id = r.property_id
         JOIN public.boarding_house_app_users ul ON ul.id = r.owner_user_id
         JOIN public.boarding_house_app_users st ON st.id = pay.student_user_id
         WHERE pay.id = $1::uuid AND r.owner_user_id = $2::uuid`,
        [id, ownerId]
      );
      const x = rows[0];
      if (!x) {
        return NextResponse.json({ error: "Payment not found." }, { status: 404 });
      }
      const amountNum = Number(x.amount);
      const monthlyRent = x.monthly_rent ? Number(x.monthly_rent) : 0;
      payment = {
        id: x.id,
        amount: amountNum,
        method: x.method,
        status: x.status,
        createdAt: new Date(x.created_at).toISOString(),
        paidAt: x.paid_at ? new Date(x.paid_at).toISOString() : null,
        dormName: resolveDormDisplayName(
          x.property_name,
          x.acc_dorm_name,
          "General payment"
        ),
        roomNo: x.room_no ?? "—",
        landlord: x.landlord_name?.trim() || "—",
        leasePeriod:
          x.lease_start && x.lease_end
            ? formatLeasePeriod(new Date(x.lease_start), new Date(x.lease_end))
            : "—",
        studentName: x.student_name,
        monthlyRent: monthlyRent > 0 ? monthlyRent : null,
        lineItems: buildInitialPaymentLineItems(amountNum, monthlyRent),
        notes: x.description?.trim() || null,
        periodLabel: monthYearLabel(
          x.paid_at ? new Date(x.paid_at).toISOString().slice(0, 10) : null,
          x.created_at
        ),
        proofImageUrl: x.proof_image_url ?? null,
      };
    } else {
      const { rows } = await pool.query<{
        id: string;
        amount: string;
        method: string;
        status: string;
        created_at: Date;
        paid_on: string | null;
        reference_no: string | null;
        property_name: string | null;
        room_no: string | null;
        lease_start: string | null;
        lease_end: string | null;
        monthly_rent: string | null;
        landlord_name: string | null;
        payer_name: string;
        entry_source: string | null;
        acc_dorm_name: string | null;
      }>(
        `SELECT lp.id, lp.amount::text, lp.method, lp.status, lp.created_at,
                lp.paid_on::text, lp.reference_no,
                prop.name AS property_name, r.room_no,
                s.lease_start::text AS lease_start, s.lease_end::text AS lease_end,
                s.monthly_rent::text,
                ul.full_name AS landlord_name,
                lp.payer_name,
                lp.entry_source,
                (SELECT a.dorm_name FROM public.landlord_accreditation_requests a
                 WHERE prop.id IS NOT NULL
                   AND (a.property_id = prop.id OR a.owner_user_id = prop.owner_user_id)
                   AND trim(a.dorm_name) <> ''
                 ORDER BY a.submitted_at DESC
                 LIMIT 1) AS acc_dorm_name
         FROM public.landlord_payments lp
         LEFT JOIN public.landlord_rooms r ON r.id = lp.room_id
         LEFT JOIN public.landlord_properties prop ON prop.id = r.property_id
         JOIN public.boarding_house_app_users ul ON ul.id = lp.owner_user_id
         LEFT JOIN public.landlord_tenant_leases l ON l.id = lp.tenant_lease_id
         LEFT JOIN public.student_dorm_reservations s ON s.id = l.student_reservation_id
         WHERE lp.id = $1::uuid AND lp.owner_user_id = $2::uuid`,
        [id, ownerId]
      );
      const x = rows[0];
      if (!x) {
        return NextResponse.json({ error: "Payment not found." }, { status: 404 });
      }
      const amountNum = Number(x.amount);
      const monthlyRent = x.monthly_rent ? Number(x.monthly_rent) : 0;
      const methodLabel =
        x.entry_source === "advance"
          ? "Advance"
          : x.entry_source === "deposit"
            ? "Security deposit"
            : x.method;
      payment = {
        id: x.id,
        amount: amountNum,
        method: methodLabel,
        status: x.status,
        createdAt: new Date(x.created_at).toISOString(),
        paidAt: x.paid_on?.trim()
          ? new Date(`${x.paid_on.trim().slice(0, 10)}T12:00:00`).toISOString()
          : null,
        dormName: resolveDormDisplayName(
          x.property_name,
          x.acc_dorm_name,
          "General payment"
        ),
        roomNo: x.room_no ?? "—",
        landlord: x.landlord_name?.trim() || "—",
        leasePeriod:
          x.lease_start && x.lease_end
            ? formatLeasePeriod(new Date(x.lease_start), new Date(x.lease_end))
            : "—",
        studentName: x.payer_name,
        monthlyRent: monthlyRent > 0 ? monthlyRent : null,
        lineItems: buildInitialPaymentLineItems(amountNum, monthlyRent),
        notes:
          x.reference_no?.trim() ||
          "Recorded by landlord (onsite / manual entry).",
        periodLabel: monthYearLabel(x.paid_on, x.created_at),
      };
    }

    return NextResponse.json({ payment });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load receipt";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
