import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  buildPublicListingDescription,
  buildRoomListingGallery,
} from "@/lib/listing-description";
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
    const { rows: appRows } = await pool.query<{
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
      listing_location: string | null;
      property_address: string | null;
      property_city: string | null;
      listing_description: string | null;
      remarks: string | null;
      room_details: string | null;
      listing_image_urls: unknown;
      listing_background_url: string | null;
      room_image_urls: unknown;
    }>(
      `SELECT pay.id, pay.amount::text, pay.method, pay.status, pay.created_at, pay.paid_at,
              pay.receipt_url, pay.proof_image_url, pay.reservation_id,
              p.name AS property_name, r.room_no,
              s.lease_start::text AS lease_start, s.lease_end::text AS lease_end,
              s.monthly_rent::text AS monthly_rent,
              u.full_name AS landlord_name,
              r.listing_location, p.address AS property_address, p.city AS property_city,
              r.listing_description, r.remarks, r.room_details,
              r.listing_image_urls, r.listing_background_url, r.room_image_urls
       FROM public.student_payment_records pay
       LEFT JOIN public.student_dorm_reservations s ON s.id = pay.reservation_id
       LEFT JOIN public.landlord_rooms r ON r.id = s.room_id
       LEFT JOIN public.landlord_properties p ON p.id = r.property_id
       LEFT JOIN public.boarding_house_app_users u ON u.id = r.owner_user_id
       WHERE pay.student_user_id = $1::uuid
       ORDER BY pay.created_at DESC`,
      [studentId]
    );

    const { rows: landlordRows } = await pool.query<{
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
      listing_location: string | null;
      property_address: string | null;
      property_city: string | null;
      listing_description: string | null;
      remarks: string | null;
      room_details: string | null;
      listing_image_urls: unknown;
      listing_background_url: string | null;
      room_image_urls: unknown;
    }>(
      `SELECT lp.id, lp.amount::text, lp.method, lp.status, lp.created_at,
              lp.paid_on::text, lp.proof_url, lp.reference_no,
              p.name AS property_name, r.room_no,
              s.lease_start::text AS lease_start, s.lease_end::text AS lease_end,
              s.monthly_rent::text,
              u.full_name AS landlord_name,
              r.listing_location, p.address AS property_address, p.city AS property_city,
              r.listing_description, r.remarks, r.room_details,
              r.listing_image_urls, r.listing_background_url, r.room_image_urls
       FROM public.landlord_payments lp
       JOIN public.landlord_rooms r ON r.id = lp.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       JOIN public.boarding_house_app_users u ON u.id = r.owner_user_id
       JOIN public.student_dorm_reservations s ON s.room_id = r.id
         AND s.student_user_id = $1::uuid
         AND s.status IN ('Pending', 'Confirmed')
       JOIN public.boarding_house_app_users stu ON stu.id = s.student_user_id
       WHERE lower(trim(lp.payer_name)) = lower(trim(stu.full_name))`,
      [studentId]
    );

    const fromApp = appRows.map((x) => {
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
      const roomLabel = x.room_no ?? "?";
      const propName = x.property_name ?? "Dorm";
      const roomDescription = buildPublicListingDescription(
        x.listing_description,
        x.remarks,
        x.room_details,
        `Room ${roomLabel} at ${propName}.`
      );
      const images = buildRoomListingGallery(
        x.listing_image_urls,
        x.listing_background_url,
        x.room_image_urls
      );
      return {
        id: x.id,
        source: "student_app" as const,
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
        documentType: "Accredited",
        roomDescription,
        images,
        receiptUrl: x.receipt_url ?? undefined,
        proofImageUrl: x.proof_image_url ?? undefined,
        landlordProofUrl: undefined as string | undefined,
        referenceNo: undefined as string | undefined,
        paidAt: x.paid_at
          ? new Date(x.paid_at).toLocaleString()
          : undefined,
        leasePeriod,
      };
    });
    const fromLandlord = landlordRows.map((x) => {
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
      const roomLabel = x.room_no ?? "?";
      const propName = x.property_name ?? "Dorm";
      const roomDescription = buildPublicListingDescription(
        x.listing_description,
        x.remarks,
        x.room_details,
        `Room ${roomLabel} at ${propName}.`
      );
      const images = buildRoomListingGallery(
        x.listing_image_urls,
        x.listing_background_url,
        x.room_image_urls
      );
      const paidOn = x.paid_on?.slice(0, 10);
      const paidAtTs = paidOn
        ? new Date(`${paidOn}T12:00:00`).toLocaleString()
        : undefined;
      const st = x.status as string;
      const statusOut =
        st === "Overdue"
          ? ("Overdue" as const)
          : (st as "Paid" | "Pending" | "Failed");
      return {
        id: `lp-${x.id}`,
        source: "landlord_entry" as const,
        dormName: x.property_name ?? "General payment",
        roomNo: x.room_no ?? "—",
        amount: Number(x.amount),
        method: x.method,
        status: statusOut,
        date:
          x.paid_on?.trim()?.slice(0, 10) ??
          new Date(x.created_at).toISOString().slice(0, 10),
        moveInDate: x.lease_start?.slice(0, 10) ?? "—",
        leaseMonths: months,
        monthlyRent: x.monthly_rent ? Number(x.monthly_rent) : 0,
        location,
        landlord: x.landlord_name ?? "—",
        distance: "—",
        documentType: "Accredited",
        roomDescription,
        images,
        receiptUrl: undefined as string | undefined,
        proofImageUrl: undefined as string | undefined,
        landlordProofUrl: x.proof_url ?? undefined,
        referenceNo: x.reference_no ?? undefined,
        paidAt: paidAtTs,
        leasePeriod,
      };
    });

    const payments = [...fromApp, ...fromLandlord].sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

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
      proofImageUrl?: string;
      description?: string;
      paidAt?: string;
      paidOnDate?: string;
    };
    const amount = Math.max(0, Number(body.amount) || 0);
    if (amount <= 0) {
      return NextResponse.json({ error: "Amount is required." }, { status: 400 });
    }
    const methodRaw = (body.method ?? "GCash").trim() || "GCash";
    const method =
      methodRaw === "GCash" ||
      methodRaw === "Cash" ||
      methodRaw === "Bank Transfer"
        ? methodRaw
        : "GCash";
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

    const proofImage = (body.proofImageUrl ?? "").trim();
    const proofOk =
      proofImage.length === 0 || proofImage.startsWith("/uploads/");
    if (!proofOk) {
      return NextResponse.json(
        { error: "Proof image must be a valid uploaded file URL." },
        { status: 400 }
      );
    }
    const paidAtIso = body.paidOnDate
      ? new Date(`${body.paidOnDate}T12:00:00`).toISOString()
      : body.paidAt
        ? new Date(body.paidAt).toISOString()
        : null;

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.student_payment_records
        (student_user_id, reservation_id, amount, method, status, paid_at, receipt_url, proof_image_url, description)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz, $7, $8, $9)
       RETURNING id`,
      [
        studentId,
        reservationId,
        amount,
        method,
        status,
        paidAtIso,
        (body.receiptUrl ?? "").trim() || null,
        proofImage || null,
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
