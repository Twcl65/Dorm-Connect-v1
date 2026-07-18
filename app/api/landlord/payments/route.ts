import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { landlordLog } from "@/lib/landlord-db";
import {
  applyRecordedPaymentToSchedule,
  resolveReservationIdForPaymentContext,
  resolveLeaseIdForRoom,
} from "@/lib/payment-schedule";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

function formatPhp(n: number) {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function normalizeStudentMethod(m: string): "GCash" | "Cash" | "Bank Transfer" {
  if (m === "GCash" || m === "Cash" || m === "Bank Transfer") return m;
  return "GCash";
}

function mapStudentPayStatus(
  s: string
): "Paid" | "Pending" | "Overdue" {
  if (s === "Paid") return "Paid";
  if (s === "Failed") return "Overdue";
  return "Pending";
}

function monthYearLabel(paidOnIso: string | null | undefined, createdAt: Date) {
  const raw = paidOnIso?.slice(0, 10);
  const d = raw ? new Date(`${raw}T12:00:00`) : createdAt;
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();
    const { rows: own } = await pool.query<{
      id: string;
      created_at: Date;
      room_no: string | null;
      property_name: string | null;
      payer_name: string;
      amount: string;
      method: string;
      status: string;
      reference_no: string | null;
      proof_url: string | null;
      paid_on: string | null;
      tenant_lease_id: string | null;
      student_reservation_id: string | null;
      student_user_id: string | null;
      entry_source: string | null;
    }>(
      `SELECT p.id, p.created_at, r.room_no, prop.name AS property_name,
              p.payer_name, p.amount::text, p.method, p.status,
              p.reference_no, p.proof_url, p.paid_on::text,
              p.tenant_lease_id,
              COALESCE(l.student_reservation_id, room_res.reservation_id) AS student_reservation_id,
              COALESCE(s.student_user_id, room_res.student_user_id) AS student_user_id,
              p.entry_source
       FROM public.landlord_payments p
       LEFT JOIN public.landlord_rooms r ON r.id = p.room_id
       LEFT JOIN public.landlord_properties prop ON prop.id = r.property_id
       LEFT JOIN public.landlord_tenant_leases l ON l.id = p.tenant_lease_id
       LEFT JOIN public.student_dorm_reservations s ON s.id = l.student_reservation_id
       LEFT JOIN LATERAL (
         SELECT res.id AS reservation_id, res.student_user_id
         FROM public.student_dorm_reservations res
         WHERE res.room_id = p.room_id
           AND res.status = 'Confirmed'
         ORDER BY res.created_at DESC
         LIMIT 1
       ) room_res ON true
       WHERE p.owner_user_id = $1::uuid`,
      [ownerId]
    );

    const { rows: fromStudents } = await pool.query<{
      id: string;
      created_at: Date;
      room_no: string;
      property_name: string | null;
      payer_name: string;
      amount: string;
      method: string;
      status: string;
      receipt_url: string | null;
      proof_image_url: string | null;
      paid_at: Date | null;
      reservation_id: string;
      student_user_id: string;
    }>(
      `SELECT pay.id, pay.created_at, r.room_no, prop.name AS property_name,
              stu.full_name AS payer_name, pay.amount::text, pay.method, pay.status,
              pay.receipt_url, pay.proof_image_url, pay.paid_at, pay.reservation_id, pay.student_user_id
       FROM public.student_payment_records pay
       JOIN public.student_dorm_reservations s ON s.id = pay.reservation_id
       JOIN public.boarding_house_app_users stu ON stu.id = pay.student_user_id
       JOIN public.landlord_rooms r ON r.id = s.room_id
       LEFT JOIN public.landlord_properties prop ON prop.id = r.property_id
       WHERE r.owner_user_id = $1::uuid`,
      [ownerId]
    );

    function mapLandlordSource(
      entrySource: string | null
    ): "landlord" | "advance" | "deposit" {
      if (entrySource === "advance") return "advance";
      if (entrySource === "deposit") return "deposit";
      return "landlord";
    }

    const landlordRows = own.map((x) => ({
      id: x.id,
      source: mapLandlordSource(x.entry_source),
      roomNo: x.room_no ?? "—",
      propertyName: x.property_name ?? undefined,
      name: x.payer_name,
      amount: formatPhp(Number(x.amount)),
      amountValue: Number(x.amount),
      method:
        x.entry_source === "advance"
          ? "Advance"
          : x.entry_source === "deposit"
            ? "Security deposit"
            : x.method,
      status: x.status as "Paid" | "Pending" | "Overdue",
      referenceNo: x.reference_no ?? undefined,
      proofOfPaymentUrl: x.proof_url ?? undefined,
      date: x.paid_on?.slice(0, 10),
      periodLabel: monthYearLabel(x.paid_on, x.created_at),
      createdAt: x.created_at.toISOString(),
      tenantLeaseId: x.tenant_lease_id ?? undefined,
      reservationId: x.student_reservation_id ?? undefined,
      studentUserId: x.student_user_id ?? undefined,
    }));

    const studentRows = fromStudents.map((x) => {
      const st = mapStudentPayStatus(x.status);
      const m = normalizeStudentMethod(x.method);
      return {
        id: x.id,
        source: "student" as const,
        roomNo: x.room_no ?? "—",
        propertyName: x.property_name ?? undefined,
        name: x.payer_name,
        amount: formatPhp(Number(x.amount)),
        amountValue: Number(x.amount),
        method: m,
        status: st,
        referenceNo: undefined as string | undefined,
        // proof_image_url is what students upload from the app (GCash screenshot);
        // receipt_url is the landlord-generated receipt PDF; prefer proof_image_url
        proofOfPaymentUrl: x.proof_image_url ?? x.receipt_url ?? undefined,
        date: x.paid_at
          ? new Date(x.paid_at).toISOString().slice(0, 10)
          : new Date(x.created_at).toISOString().slice(0, 10),
        periodLabel: monthYearLabel(
          x.paid_at ? new Date(x.paid_at).toISOString().slice(0, 10) : null,
          x.created_at
        ),
        createdAt: x.created_at.toISOString(),
        reservationId: x.reservation_id,
        studentUserId: x.student_user_id,
      };
    });

    const payments = [...landlordRows, ...studentRows].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ payments });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load payments";
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
      roomId?: string;
      roomNo?: string;
      tenantLeaseId?: string;
      studentUserId?: string;
      payerName?: string;
      amount?: number;
      method?: string;
      status?: string;
      referenceNo?: string;
      proofUrl?: string;
      paidOn?: string;
      scheduleMonthNumber?: number;
    };
    let payerName = (body.payerName ?? "").trim();
    const method =
      body.method === "GCash" ||
      body.method === "Cash" ||
      body.method === "Bank Transfer" ||
      body.method === "Advance" ||
      body.method === "Security deposit"
        ? body.method
        : "Cash";
    const status =
      body.status === "Paid" ||
      body.status === "Pending" ||
      body.status === "Overdue"
        ? body.status
        : "Pending";
    const amount = Math.max(0, Number(body.amount) || 0);

    const pool = await getPool();
    const uuidRe = /^[0-9a-f-]{36}$/i;
    let roomId: string | null =
      body.roomId && uuidRe.test(body.roomId) ? body.roomId : null;
    const roomNo = (body.roomNo ?? "").trim();

    if (roomId) {
      const { rows: roomRows } = await pool.query<{ id: string }>(
        `SELECT id FROM public.landlord_rooms
         WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
         [roomId, ownerId]
      );
      if (!roomRows[0]) {
        return NextResponse.json({ error: "Room not found." }, { status: 404 });
      }
    } else if (roomNo) {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM public.landlord_rooms
         WHERE owner_user_id = $1::uuid AND room_no = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [ownerId, roomNo]
      );
      roomId = rows[0]?.id ?? null;
    }

    let tenantLeaseId: string | null =
      body.tenantLeaseId && uuidRe.test(body.tenantLeaseId)
        ? body.tenantLeaseId
        : null;

    if (tenantLeaseId) {
      const { rows: leaseRows } = await pool.query<{
        id: string;
        room_id: string;
        student_user_id: string | null;
        full_name: string | null;
        guest_name: string | null;
      }>(
        `SELECT l.id, l.room_id, s.student_user_id,
                u.full_name, s.guest_name
         FROM public.landlord_tenant_leases l
         LEFT JOIN public.student_dorm_reservations s
           ON s.id = l.student_reservation_id
         LEFT JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
         WHERE l.id = $1::uuid AND l.owner_user_id = $2::uuid`,
        [tenantLeaseId, ownerId]
      );
      const lease = leaseRows[0];
      if (!lease) {
        return NextResponse.json({ error: "Lease not found." }, { status: 404 });
      }
      if (!roomId) roomId = lease.room_id;
      if (lease.student_user_id) {
        if (
          body.studentUserId &&
          uuidRe.test(body.studentUserId) &&
          body.studentUserId !== lease.student_user_id
        ) {
          return NextResponse.json(
            { error: "Tenant does not match the selected lease." },
            { status: 400 }
          );
        }
        payerName =
          lease.full_name?.trim() ||
          payerName ||
          lease.guest_name?.trim() ||
          "";
      }
    } else if (
      body.studentUserId &&
      uuidRe.test(body.studentUserId) &&
      roomId
    ) {
      const { rows: stuRows } = await pool.query<{ full_name: string }>(
        `SELECT u.full_name
         FROM public.student_dorm_reservations s
         JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
         WHERE s.student_user_id = $1::uuid
           AND s.room_id = $2::uuid
           AND s.status IN ('Pending', 'Confirmed')
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [body.studentUserId, roomId]
      );
      if (stuRows[0]?.full_name?.trim()) {
        payerName = stuRows[0].full_name.trim();
      }
    }

    if (!payerName) {
      return NextResponse.json({ error: "Payer name is required." }, { status: 400 });
    }

    if (!tenantLeaseId && roomId) {
      tenantLeaseId = await resolveLeaseIdForRoom(pool, ownerId, roomId);
    }

    const reservationId = await resolveReservationIdForPaymentContext(pool, {
      tenantLeaseId,
      roomId,
      studentUserId: body.studentUserId && uuidRe.test(body.studentUserId) ? body.studentUserId : null,
    });

    let entrySource = 'manual';
    if (method === 'Advance' || method === 'Security deposit') {
      entrySource = method === 'Advance' ? 'advance' : 'deposit';
      if (!reservationId) {
        return NextResponse.json({ error: "Advance/deposit payments require a tenant linked to a student reservation." }, { status: 400 });
      }

      const { rows: resRows } = await pool.query<{
        advance_amount: string;
        deposit_amount: string;
      }>(
        `SELECT advance_amount::text, deposit_amount::text
         FROM public.student_dorm_reservations
         WHERE id = $1::uuid`,
        [reservationId]
      );
      const res = resRows[0];
      if (!res) {
        return NextResponse.json({ error: "Linked student reservation not found." }, { status: 404 });
      }
      const advanceAvail = Number(res.advance_amount) || 0;
      const depositAvail = Number(res.deposit_amount) || 0;
      if (entrySource === 'advance' && advanceAvail < amount - 0.01) {
        return NextResponse.json({ error: `Insufficient advance balance (₱${advanceAvail.toLocaleString()} available).` }, { status: 400 });
      }
      if (entrySource === 'deposit' && depositAvail < amount - 0.01) {
        return NextResponse.json({ error: `Insufficient security deposit (₱${depositAvail.toLocaleString()} available).` }, { status: 400 });
      }

      // Deduct from reservation balances
      const newAdvance = entrySource === 'advance' ? Math.max(0, advanceAvail - amount) : advanceAvail;
      const newDeposit = entrySource === 'deposit' ? Math.max(0, depositAvail - amount) : depositAvail;
      await pool.query(
        `UPDATE public.student_dorm_reservations
         SET advance_amount = $1, deposit_amount = $2, updated_at = now()
         WHERE id = $3::uuid`,
        [newAdvance, newDeposit, reservationId]
      );
    }

    const paidOn = body.paidOn?.slice(0, 10) || null;
    const methodCol = (entrySource === 'advance' || entrySource === 'deposit') ? 'Cash' : method;
    const scheduleMonthNumber = body.scheduleMonthNumber ? Number(body.scheduleMonthNumber) : null;

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.landlord_payments
        (owner_user_id, room_id, tenant_lease_id, payer_name, amount, method, status,
         reference_no, proof_url, paid_on, entry_source, schedule_month_number)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10::date, $11, $12)
       RETURNING id`,
      [
        ownerId,
        roomId,
        tenantLeaseId,
        payerName,
        amount,
        methodCol,
        status,
        (body.referenceNo ?? "").trim() || null,
        (body.proofUrl ?? "").trim() || null,
        paidOn,
        entrySource,
        scheduleMonthNumber,
      ]
    );

    if (status === "Paid") {
      if (reservationId) {
        await applyRecordedPaymentToSchedule(pool, {
          reservationId,
          amount,
          paidOn,
          scheduleMonthNumber,
        });
      } else if (tenantLeaseId) {
        await applyRecordedPaymentToSchedule(pool, {
          leaseId: tenantLeaseId,
          amount,
          paidOn,
          scheduleMonthNumber,
        });
      } else if (roomId) {
        const leaseId = await resolveLeaseIdForRoom(pool, ownerId, roomId);
        if (leaseId) {
          await applyRecordedPaymentToSchedule(pool, {
            leaseId,
            amount,
            paidOn,
            scheduleMonthNumber,
          });
        }
      }
    }

    await landlordLog(pool, ownerId, `Recorded payment ${payerName} ${status}`);
    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create payment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
