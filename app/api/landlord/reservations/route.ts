import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureLandlordProperty, landlordLog } from "@/lib/landlord-db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

function period(a: string, b: string) {
  return `${new Date(a).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${new Date(b).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();
    await ensureLandlordProperty(pool, ownerId);

    const { rows: manual } = await pool.query<{
      id: string;
      created_at: Date;
      room_id: string | null;
      room_no: string | null;
      guest_name: string;
      lease_start: string;
      lease_end: string;
      status: string;
      payment_method: string | null;
      amount_paid: string;
      reference_no: string | null;
      proof_url: string | null;
      email: string | null;
      contact: string | null;
      property_name: string;
    }>(
      `SELECT r.id, r.created_at, r.room_id, rm.room_no, r.guest_name,
              r.lease_start::text, r.lease_end::text, r.status,
              r.payment_method, r.amount_paid::text, r.reference_no, r.proof_url,
              r.email, r.contact, p.name AS property_name
       FROM public.landlord_reservations r
       JOIN public.landlord_properties p ON p.id = r.property_id
       LEFT JOIN public.landlord_rooms rm ON rm.id = r.room_id
       WHERE r.owner_user_id = $1::uuid`,
      [ownerId]
    );

    const { rows: fromStudents } = await pool.query<{
      id: string;
      created_at: Date;
      room_no: string;
      guest_name: string;
      student_email: string;
      lease_start: string;
      lease_end: string;
      status: string;
      rent_payment_status: string;
      property_name: string;
    }>(
      `SELECT s.id, s.created_at, r.room_no, stu.full_name AS guest_name, stu.email AS student_email,
              s.lease_start::text, s.lease_end::text, s.status, s.rent_payment_status,
              p.name AS property_name
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       JOIN public.boarding_house_app_users stu ON stu.id = s.student_user_id
       WHERE r.owner_user_id = $1::uuid`,
      [ownerId]
    );

    const manualList = manual.map((r) => ({
      id: r.id,
      source: "manual" as const,
      roomNo: r.room_no ?? "—",
      name: r.guest_name,
      leasePeriod: period(r.lease_start, r.lease_end),
      reservationStatus: r.status as "Confirmed" | "Pending" | "Cancelled",
      dormName: r.property_name,
      email: r.email ?? undefined,
      contact: r.contact ?? undefined,
      rentPaymentStatus: undefined as string | undefined,
      createdAt: r.created_at.toISOString(),
    }));

    const studentList = fromStudents.map((s) => ({
      id: s.id,
      source: "student" as const,
      roomNo: s.room_no ?? "—",
      name: s.guest_name,
      leasePeriod: period(s.lease_start, s.lease_end),
      reservationStatus: s.status as "Confirmed" | "Pending" | "Cancelled",
      dormName: s.property_name,
      email: s.student_email,
      contact: undefined as string | undefined,
      rentPaymentStatus: s.rent_payment_status,
      createdAt: s.created_at.toISOString(),
    }));

    const list = [...manualList, ...studentList].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const stats = {
      total: list.length,
      confirmed: list.filter((x) => x.reservationStatus === "Confirmed").length,
      pending: list.filter((x) => x.reservationStatus === "Pending").length,
      cancelled: list.filter((x) => x.reservationStatus === "Cancelled").length,
    };

    return NextResponse.json({ reservations: list, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load reservations";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const body = (await req.json()) as {
      guestName?: string;
      roomNo?: string;
      leaseStart?: string;
      leaseEnd?: string;
      email?: string;
      contact?: string;
      status?: string;
      paymentMethod?: string;
      amountPaid?: number;
      referenceNo?: string;
      proofUrl?: string;
    };
    const guestName = (body.guestName ?? "").trim();
    const leaseStart = body.leaseStart;
    const leaseEnd = body.leaseEnd;
    if (!guestName || !leaseStart || !leaseEnd) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const pool = await getPool();
    const propertyId = await ensureLandlordProperty(pool, ownerId);

    let roomId: string | null = null;
    const roomNo = (body.roomNo ?? "").trim();
    if (roomNo) {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM public.landlord_rooms
         WHERE owner_user_id = $1::uuid AND property_id = $2::uuid AND room_no = $3`,
        [ownerId, propertyId, roomNo]
      );
      roomId = rows[0]?.id ?? null;
    }

    const status =
      body.status === "Confirmed" ||
      body.status === "Pending" ||
      body.status === "Cancelled"
        ? body.status
        : "Pending";

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.landlord_reservations
        (owner_user_id, property_id, room_id, guest_name, email, contact,
         lease_start, lease_end, status, payment_method, amount_paid, reference_no, proof_url)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::date, $8::date, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        ownerId,
        propertyId,
        roomId,
        guestName,
        (body.email ?? "").trim() || null,
        (body.contact ?? "").trim() || null,
        leaseStart,
        leaseEnd,
        status,
        (body.paymentMethod ?? "").trim() || null,
        Math.max(0, Number(body.amountPaid) || 0),
        (body.referenceNo ?? "").trim() || null,
        (body.proofUrl ?? "").trim() || null,
      ]
    );

    await landlordLog(
      pool,
      ownerId,
      `Reservation ${status} for ${guestName}`
    );
    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create reservation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
