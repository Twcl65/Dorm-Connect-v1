import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  buildPublicListingDescription,
  buildRoomListingGallery,
} from "@/lib/listing-description";
import { requireStudent } from "@/lib/require-student";
import { formatLeasePeriod } from "@/lib/student-db";
import {
  resolveDormDisplayName,
  syncReservationAndLeaseFromStudentPaymentStatus,
} from "@/lib/landlord-db";
import { insertNotification } from "@/lib/notify-user";
import { MATCHED_STUDENT_LANDLORD_PAYMENTS_CTE } from "@/lib/student-landlord-payment-match";
import {
  fetchMonthlySchedule,
  resolveUpcomingUnpaidMonthsFromSchedule,
} from "@/lib/payment-schedule";
import { isAllowedStoredFileUrl } from "@/lib/upload-url";

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
      description: string | null;
      listing_image_urls: unknown;
      listing_background_url: string | null;
      room_image_urls: unknown;
      acc_dorm_name: string | null;
    }>(
      `SELECT pay.id, pay.amount::text, pay.method, pay.status, pay.created_at, pay.paid_at,
              pay.receipt_url, pay.proof_image_url, pay.description, pay.reservation_id,
              p.name AS property_name, r.room_no,
              s.lease_start::text AS lease_start, s.lease_end::text AS lease_end,
              s.monthly_rent::text AS monthly_rent,
              ul.full_name AS landlord_name,
              r.listing_location, p.address AS property_address, p.city AS property_city,
              r.listing_description, r.remarks, r.room_details,
              r.listing_image_urls, r.listing_background_url, r.room_image_urls,
              (SELECT a.dorm_name FROM public.landlord_accreditation_requests a
               WHERE p.id IS NOT NULL
                 AND (a.property_id = p.id OR a.owner_user_id = p.owner_user_id)
                 AND trim(a.dorm_name) <> ''
               ORDER BY a.submitted_at DESC
               LIMIT 1) AS acc_dorm_name
       FROM public.student_payment_records pay
       LEFT JOIN public.student_dorm_reservations s ON s.id = pay.reservation_id
       LEFT JOIN public.landlord_rooms r ON r.id = s.room_id
       LEFT JOIN public.landlord_properties p ON p.id = r.property_id
       LEFT JOIN public.boarding_house_app_users ul ON ul.id = p.owner_user_id
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
      acc_dorm_name: string | null;
      entry_source: string | null;
    }>(
      `WITH ${MATCHED_STUDENT_LANDLORD_PAYMENTS_CTE}
       SELECT DISTINCT ON (lp.id)
              lp.id, lp.amount::text, lp.method, lp.status, lp.created_at,
              lp.paid_on::text, lp.proof_url, lp.reference_no, lp.entry_source,
              p.name AS property_name, r.room_no,
              s.lease_start::text AS lease_start, s.lease_end::text AS lease_end,
              s.monthly_rent::text,
              ul.full_name AS landlord_name,
              r.listing_location, p.address AS property_address, p.city AS property_city,
              r.listing_description, r.remarks, r.room_details,
              r.listing_image_urls, r.listing_background_url, r.room_image_urls,
              (SELECT a.dorm_name FROM public.landlord_accreditation_requests a
               WHERE p.id IS NOT NULL
                 AND (a.property_id = p.id OR a.owner_user_id = p.owner_user_id)
                 AND trim(a.dorm_name) <> ''
               ORDER BY a.submitted_at DESC
               LIMIT 1) AS acc_dorm_name
       FROM public.landlord_payments lp
       INNER JOIN matched_student_landlord_payments m ON m.id = lp.id
       LEFT JOIN public.landlord_tenant_leases ltl ON ltl.id = lp.tenant_lease_id
       LEFT JOIN LATERAL (
         SELECT sr.lease_start, sr.lease_end, sr.monthly_rent, sr.room_id
         FROM public.student_dorm_reservations sr
         WHERE sr.student_user_id = $1::uuid
           AND sr.status <> 'Cancelled'
           AND (
             (ltl.student_reservation_id IS NOT NULL AND sr.id = ltl.student_reservation_id)
             OR (lp.room_id IS NOT NULL AND sr.room_id = lp.room_id)
           )
         ORDER BY
           CASE
             WHEN ltl.student_reservation_id IS NOT NULL
               AND sr.id = ltl.student_reservation_id
             THEN 0
             ELSE 1
           END,
           sr.lease_end DESC
         LIMIT 1
       ) s ON true
       LEFT JOIN public.landlord_rooms r ON r.id = COALESCE(lp.room_id, s.room_id)
       LEFT JOIN public.landlord_properties p ON p.id = r.property_id
       LEFT JOIN public.boarding_house_app_users ul ON ul.id = COALESCE(p.owner_user_id, lp.owner_user_id)
       ORDER BY lp.id, lp.created_at DESC`,
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
      const dormName = resolveDormDisplayName(
        x.property_name,
        x.acc_dorm_name,
        "General payment"
      );
      const propName = dormName;
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
        channelLabel: "Student app",
        description: x.description?.trim() || undefined,
        dormName,
        roomNo: x.room_no ?? "—",
        amount: Number(x.amount),
        method: x.method,
        status: x.status as "Paid" | "Pending" | "Failed",
        date: new Date(x.created_at).toISOString().slice(0, 10),
        moveInDate: x.lease_start?.slice(0, 10) ?? "—",
        leaseMonths: months,
        monthlyRent: x.monthly_rent ? Number(x.monthly_rent) : 0,
        location,
        landlord: x.landlord_name?.trim() || "—",
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
      const dormName = resolveDormDisplayName(
        x.property_name,
        x.acc_dorm_name,
        "General payment"
      );
      const propName = dormName;
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
      const entrySource = x.entry_source;
      const channelLabel =
        entrySource === "advance"
          ? "Advance payment"
          : entrySource === "deposit"
            ? "Security deposit"
            : "Manual";
      return {
        id: `lp-${x.id}`,
        source: "landlord_entry" as const,
        entrySource: entrySource ?? "manual",
        channelLabel,
        description: undefined as string | undefined,
        dormName,
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
        landlord: x.landlord_name?.trim() || "—",
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

    let unpaidMonths: ReturnType<typeof resolveUpcomingUnpaidMonthsFromSchedule> =
      [];
    const { rows: activeRes } = await pool.query<{
      id: string;
      property_name: string | null;
      room_no: string;
      acc_dorm_name: string | null;
    }>(
      `SELECT s.id, p.name AS property_name, r.room_no,
              (SELECT a.dorm_name FROM public.landlord_accreditation_requests a
               WHERE (a.property_id = p.id OR a.owner_user_id = p.owner_user_id)
                 AND trim(a.dorm_name) <> ''
               ORDER BY a.submitted_at DESC
               LIMIT 1) AS acc_dorm_name
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE s.student_user_id = $1::uuid AND s.status = 'Confirmed'
       ORDER BY s.lease_start DESC
       LIMIT 1`,
      [studentId]
    );
    const active = activeRes[0];
    if (active) {
      const schedule = await fetchMonthlySchedule(pool, {
        reservationId: active.id,
      });
      const dormName = resolveDormDisplayName(
        active.property_name,
        active.acc_dorm_name,
        "Your dorm"
      );
      unpaidMonths = resolveUpcomingUnpaidMonthsFromSchedule(schedule).map(
        (m) => ({
          ...m,
          dormName,
          roomNo: active.room_no,
        })
      );
    }

    return NextResponse.json({ payments, unpaidMonths });
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
      proofImage.length === 0 || isAllowedStoredFileUrl(proofImage);
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
      const { rows: ownRows } = await pool.query<{
        owner_user_id: string;
        property_name: string;
        room_no: string;
      }>(
        `SELECT r.owner_user_id, p.name AS property_name, r.room_no
         FROM public.student_dorm_reservations s
         JOIN public.landlord_rooms r ON r.id = s.room_id
         JOIN public.landlord_properties p ON p.id = r.property_id
         WHERE s.id = $1::uuid AND s.student_user_id = $2::uuid`,
        [reservationId, studentId]
      );
      const own = ownRows[0];
      if (own?.owner_user_id) {
        await syncReservationAndLeaseFromStudentPaymentStatus(
          pool,
          own.owner_user_id,
          reservationId,
          status as "Paid" | "Pending" | "Failed"
        );
        if (status === "Pending") {
          try {
            await insertNotification(
              pool,
              own.owner_user_id,
              "Payment submitted",
              `${session.name} submitted ₱${amount.toLocaleString()} for ${own.property_name} · Room ${own.room_no}. Review in Payments.`,
              "payment"
            );
          } catch {
            /* non-fatal */
          }
        }
      }
    }

    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to record payment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
