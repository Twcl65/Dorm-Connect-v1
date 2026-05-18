import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { landlordLog } from "@/lib/landlord-db";
import {
  reconcileScheduleWithPaidPayments,
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
      payer_name: string;
      amount: string;
      method: string;
      status: string;
      reference_no: string | null;
      proof_url: string | null;
      paid_on: string | null;
    }>(
      `SELECT p.id, p.created_at, r.room_no, p.payer_name, p.amount::text, p.method, p.status,
              p.reference_no, p.proof_url, p.paid_on::text
       FROM public.landlord_payments p
       LEFT JOIN public.landlord_rooms r ON r.id = p.room_id
       WHERE p.owner_user_id = $1::uuid`,
      [ownerId]
    );

    const { rows: fromStudents } = await pool.query<{
      id: string;
      created_at: Date;
      room_no: string;
      payer_name: string;
      amount: string;
      method: string;
      status: string;
      receipt_url: string | null;
      paid_at: Date | null;
    }>(
      `SELECT pay.id, pay.created_at, r.room_no, stu.full_name AS payer_name,
              pay.amount::text, pay.method, pay.status, pay.receipt_url, pay.paid_at
       FROM public.student_payment_records pay
       JOIN public.student_dorm_reservations s ON s.id = pay.reservation_id
       JOIN public.boarding_house_app_users stu ON stu.id = pay.student_user_id
       JOIN public.landlord_rooms r ON r.id = s.room_id
       WHERE r.owner_user_id = $1::uuid`,
      [ownerId]
    );

    const landlordRows = own.map((x) => ({
      id: x.id,
      source: "landlord" as const,
      roomNo: x.room_no ?? "—",
      name: x.payer_name,
      amount: formatPhp(Number(x.amount)),
      amountValue: Number(x.amount),
      method: x.method as "GCash" | "Cash" | "Bank Transfer",
      status: x.status as "Paid" | "Pending" | "Overdue",
      referenceNo: x.reference_no ?? undefined,
      proofOfPaymentUrl: x.proof_url ?? undefined,
      date: x.paid_on?.slice(0, 10),
      periodLabel: monthYearLabel(x.paid_on, x.created_at),
      createdAt: x.created_at.toISOString(),
    }));

    const studentRows = fromStudents.map((x) => {
      const st = mapStudentPayStatus(x.status);
      const m = normalizeStudentMethod(x.method);
      return {
        id: x.id,
        source: "student" as const,
        roomNo: x.room_no ?? "—",
        name: x.payer_name,
        amount: formatPhp(Number(x.amount)),
        amountValue: Number(x.amount),
        method: m,
        status: st,
        referenceNo: undefined as string | undefined,
        proofOfPaymentUrl: x.receipt_url ?? undefined,
        date: x.paid_at
          ? new Date(x.paid_at).toISOString().slice(0, 10)
          : new Date(x.created_at).toISOString().slice(0, 10),
        periodLabel: monthYearLabel(
          x.paid_at ? new Date(x.paid_at).toISOString().slice(0, 10) : null,
          x.created_at
        ),
        createdAt: x.created_at.toISOString(),
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
      roomNo?: string;
      payerName?: string;
      amount?: number;
      method?: string;
      status?: string;
      referenceNo?: string;
      proofUrl?: string;
      paidOn?: string;
    };
    const payerName = (body.payerName ?? "").trim();
    if (!payerName) {
      return NextResponse.json({ error: "Payer name is required." }, { status: 400 });
    }
    const method =
      body.method === "GCash" ||
      body.method === "Cash" ||
      body.method === "Bank Transfer"
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
    let roomId: string | null = null;
    const roomNo = (body.roomNo ?? "").trim();
    if (roomNo) {
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM public.landlord_rooms
         WHERE owner_user_id = $1::uuid AND room_no = $2
         LIMIT 1`,
        [ownerId, roomNo]
      );
      roomId = rows[0]?.id ?? null;
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.landlord_payments
        (owner_user_id, room_id, payer_name, amount, method, status,
         reference_no, proof_url, paid_on)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::date)
       RETURNING id`,
      [
        ownerId,
        roomId,
        payerName,
        amount,
        method,
        status,
        (body.referenceNo ?? "").trim() || null,
        (body.proofUrl ?? "").trim() || null,
        body.paidOn?.slice(0, 10) || null,
      ]
    );

    if (status === "Paid" && roomId) {
      const leaseId = await resolveLeaseIdForRoom(pool, ownerId, roomId);
      if (leaseId) {
        await reconcileScheduleWithPaidPayments(pool, {
          leaseId,
        });
      }
    }

    await landlordLog(pool, ownerId, `Recorded payment ${payerName} ${status}`);
    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create payment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
