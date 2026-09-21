import { NextResponse } from "next/server";
import {
  API_CACHE_TTL_MS,
  cacheKey,
  getCached,
  invalidateLandlordUser,
  invalidateStudentUser,
  setCached,
} from "@/lib/api-cache";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";
import {
  buildPublicListingDescription,
  buildRoomListingGallery,
} from "@/lib/listing-description";
import {
  formatLeasePeriod,
  landlordStatusToStudentApproved,
} from "@/lib/student-db";
import {
  countLeaseMonths,
  fetchMonthlySchedule,
  resolveNextUnpaidDueFromSchedule,
} from "@/lib/payment-schedule";
import { reservationLifecycle } from "@/lib/student-db";
import {
  studentRentLabel,
  studentStayLabel,
} from "@/lib/student-status-labels";
import { assertStudentCanReserve } from "@/lib/student-can-reserve";
import { insertNotification } from "@/lib/notify-user";
import { refreshRoomFromStudentReservations } from "@/lib/landlord-db";
import { isAllowedStoredFileUrl } from "@/lib/upload-url";
import {
  ensureLeaseExtensionColumns,
  mapLeaseExtension,
} from "@/lib/lease-extension";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;

  const cacheK = cacheKey(["student", studentId, "reservations"]);
  const hit = getCached<{ reservations: unknown[] }>(cacheK);
  if (hit) {
    return NextResponse.json(hit, { headers: { "X-Cache": "HIT" } });
  }

  try {
    const pool = await getPool();
    await ensureLeaseExtensionColumns(pool);
    const { rows } = await pool.query<{
      id: string;
      property_name: string;
      room_no: string;
      lease_start: string;
      lease_end: string;
      status: string;
      monthly_rent: string;
      listing_location: string | null;
      property_address: string | null;
      property_city: string | null;
      landlord_name: string;
      gcash_account_name: string | null;
      gcash_phone: string | null;
      gcash_qr_code_url: string | null;
      created_at: Date;
      capacity: number;
      room_size_label: string | null;
      room_details: string | null;
      listing_description: string | null;
      remarks: string | null;
      listing_image_urls: unknown;
      listing_background_url: string | null;
      room_image_urls: unknown;
      payment_sent: boolean;
      rent_payment_status: string;
      lease_extension_status: string | null;
      lease_extension_requested_end: string | null;
    }>(
      `SELECT s.id, p.name AS property_name, r.room_no,
              s.lease_start::text, s.lease_end::text, s.status,
              s.monthly_rent::text,
              r.listing_location, p.address AS property_address, p.city AS property_city,
              u.full_name AS landlord_name,
              u.gcash_account_name, u.gcash_phone, u.gcash_qr_code_url,
              s.created_at,
              r.capacity, r.room_size_label, r.room_details,
              r.listing_description, r.remarks,
              r.listing_image_urls, r.listing_background_url, r.room_image_urls,
              s.rent_payment_status,
              s.lease_extension_status,
              s.lease_extension_requested_end::text,
              EXISTS (
                SELECT 1 FROM public.student_payment_records pr
                WHERE pr.reservation_id = s.id
              ) AS payment_sent
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       JOIN public.boarding_house_app_users u
         ON u.id = COALESCE(p.owner_user_id, r.owner_user_id)
       WHERE s.student_user_id = $1::uuid
       ORDER BY s.created_at DESC`,
      [studentId]
    );

    const now = new Date();
    const list = await Promise.all(rows.map(async (x) => {
      const ls = new Date(`${x.lease_start.slice(0, 10)}T12:00:00`);
      const le = new Date(`${x.lease_end.slice(0, 10)}T12:00:00`);
      const months = countLeaseMonths(ls, le);
      const lifecycle = reservationLifecycle(x.status, le, now);
      let rentLabel = studentRentLabel(null, x.rent_payment_status);
      if (x.status === "Confirmed") {
        const schedule = await fetchMonthlySchedule(pool, {
          reservationId: x.id,
        });
        if (schedule.length > 0) {
          rentLabel = studentRentLabel(
            resolveNextUnpaidDueFromSchedule(schedule).urgency,
            x.rent_payment_status
          );
        }
      }
      const location =
        x.listing_location?.trim() ||
        [x.property_address, x.property_city].filter(Boolean).join(", ") ||
        "—";
      const description = buildPublicListingDescription(
        x.listing_description,
        x.remarks,
        x.room_details,
        `Room ${x.room_no} at ${x.property_name}. Contact the landlord for a tour.`
      );
      const images = buildRoomListingGallery(
        x.listing_image_urls,
        x.listing_background_url,
        x.room_image_urls
      );
      const sizeLine = x.room_size_label?.trim();
      const roomDetails = x.room_details?.trim() ?? null;
      const amenities = [
        "Listed on DormConnect",
        ...(sizeLine ? [`Size: ${sizeLine}`] : []),
      ];
      return {
        id: x.id,
        dorm: x.property_name,
        room: x.room_no,
        status: landlordStatusToStudentApproved(x.status),
        date: new Date(x.created_at).toISOString().slice(0, 10),
        moveInDate: x.lease_start.slice(0, 10),
        leaseEndDate: x.lease_end.slice(0, 10),
        leaseMonths: months,
        monthlyRent: Number(x.monthly_rent),
        location,
        landlord: x.landlord_name,
        gcashAccountName: x.gcash_account_name?.trim() || null,
        gcashPhone: x.gcash_phone?.trim() || null,
        gcashQrCodeUrl: x.gcash_qr_code_url?.trim() || null,
        distance: "—",
        documentType: "Accredited",
        description,
        roomDetails,
        roomSizeLabel: sizeLine ?? null,
        capacity: String(x.capacity),
        amenities,
        images,
        leasePeriod: formatLeasePeriod(ls, le),
        paymentSent: x.payment_sent,
        stayLabel: studentStayLabel(lifecycle),
        rentLabel,
        leaseExtension: mapLeaseExtension(
          x.lease_extension_status,
          x.lease_extension_requested_end
        ),
      };
    }));

    const payload = { reservations: list };
    setCached(cacheK, payload, API_CACHE_TTL_MS);
    return NextResponse.json(payload, { headers: { "X-Cache": "MISS" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load reservations";
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
      roomId?: string;
      leaseStart?: string;
      leaseEnd?: string;
      notes?: string;
      guestName?: string;
      contactPhone?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      course?: string;
      studentIdProofUrl?: string;
      reservationFee?: number;
    };
    const roomId = (body.roomId ?? "").trim();
    const leaseStart = body.leaseStart;
    const leaseEnd = body.leaseEnd;
    if (!roomId || !leaseStart || !leaseEnd) {
      return NextResponse.json(
        { error: "roomId, leaseStart, and leaseEnd are required." },
        { status: 400 }
      );
    }

    const guestName = (body.guestName ?? "").trim() || session.name;
    const contactPhone = (body.contactPhone ?? "").trim();
    const emergencyName = (body.emergencyContactName ?? "").trim();
    const emergencyPhone = (body.emergencyContactPhone ?? "").trim();
    const course = (body.course ?? "").trim();
    const proof = (body.studentIdProofUrl ?? "").trim();
    const reservationFee = Math.max(
      0,
      Number(body.reservationFee ?? 0) || 0
    );

    const needBookingForm =
      Boolean(contactPhone) ||
      Boolean(emergencyName) ||
      Boolean(emergencyPhone) ||
      Boolean(course) ||
      Boolean(proof);
    if (needBookingForm) {
      if (!contactPhone || !emergencyName || !emergencyPhone || !course) {
        return NextResponse.json(
          {
            error:
              "Contact number, emergency contact name/phone, and course are required for this reservation.",
          },
          { status: 400 }
        );
      }
      if (!proof || !isAllowedStoredFileUrl(proof)) {
        return NextResponse.json(
          { error: "Student ID proof upload is required." },
          { status: 400 }
        );
      }
    }

    const pool = await getPool();
    const gate = await assertStudentCanReserve(pool, studentId);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.reason }, { status: 403 });
    }

    const { rows: rm } = await pool.query<{
      id: string;
      monthly_rate: string;
      status: string;
      capacity: number;
      is_listed: boolean;
      operational_status: string;
      accredited: boolean;
      owner_user_id: string;
      property_name: string;
      room_no: string;
    }>(
      `SELECT r.id, r.room_no, r.monthly_rate::text, r.status, r.capacity,
              r.is_listed, p.operational_status, p.name AS property_name,
              r.owner_user_id,
              EXISTS (
                SELECT 1 FROM public.landlord_accreditation_requests acc
                WHERE acc.property_id = r.property_id AND acc.status = 'Approved'
              ) AS accredited
       FROM public.landlord_rooms r
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE r.id = $1::uuid`,
      [roomId]
    );
    const room = rm[0];
    if (
      !room ||
      !room.is_listed ||
      room.status === "Maintenance" ||
      !room.accredited ||
      room.operational_status === "Not Operating"
    ) {
      return NextResponse.json(
        {
          error:
            "That room is not available. Only listed rooms in accredited, operating dormitories can be reserved.",
        },
        { status: 400 }
      );
    }

    const { rows: occupancyRows } = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c
       FROM (
         SELECT id FROM public.landlord_tenant_leases WHERE room_id = $1::uuid
         UNION ALL
         SELECT s.id FROM public.student_dorm_reservations s
         WHERE s.room_id = $1::uuid
           AND s.status IN ('Pending', 'Confirmed')
           AND NOT EXISTS (
             SELECT 1 FROM public.landlord_tenant_leases l
             WHERE l.student_reservation_id = s.id
           )
         UNION ALL
         SELECT id FROM public.landlord_reservations
         WHERE room_id = $1::uuid AND status IN ('Pending', 'Confirmed')
       ) AS occupancy`,
      [roomId]
    );
    const currentOccupancy = Number(occupancyRows[0]?.c ?? 0);
    if (currentOccupancy >= room.capacity) {
      return NextResponse.json(
        {
          error:
            "That room is fully booked. No more students can reserve this room.",
        },
        { status: 400 }
      );
    }

    const monthly = Number(room.monthly_rate);
    const balance = Math.max(0, monthly - reservationFee);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.student_dorm_reservations
        (student_user_id, room_id, guest_name, lease_start, lease_end, monthly_rent,
         status, notes, balance_remaining, contact_phone, emergency_contact_name,
         emergency_contact_phone, course, student_id_proof_url, reservation_fee)
       VALUES ($1::uuid, $2::uuid, $3, $4::date, $5::date, $6, 'Pending', $7, $8,
         $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        studentId,
        roomId,
        guestName,
        leaseStart.slice(0, 10),
        leaseEnd.slice(0, 10),
        monthly,
        (body.notes ?? "").trim() || null,
        balance,
        contactPhone || null,
        emergencyName || null,
        emergencyPhone || null,
        course || null,
        proof || null,
        reservationFee,
      ]
    );

    await refreshRoomFromStudentReservations(pool, roomId);

    try {
      await insertNotification(
        pool,
        room.owner_user_id,
        "New reservation request",
        `${session.name} requested Room ${room.room_no} at ${room.property_name}.`,
        "reservation"
      );
    } catch {
      /* non-fatal */
    }

    invalidateStudentUser(studentId);
    invalidateLandlordUser(room.owner_user_id);
    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create reservation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
