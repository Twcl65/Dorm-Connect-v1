import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  countLeaseMonths,
  ensurePaymentDueDatesForLease,
  ensurePaymentDueDatesForReservation,
  fetchMonthlySchedule,
  reconcileScheduleWithPaidPayments,
} from "@/lib/payment-schedule";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();

    const { rows: leaseLinks } = await pool.query<{
      id: string;
      student_reservation_id: string;
    }>(
      `SELECT id, student_reservation_id
       FROM public.landlord_tenant_leases
       WHERE owner_user_id = $1::uuid AND student_reservation_id IS NOT NULL`,
      [ownerId]
    );
    const leaseIdByReservation = new Map(
      leaseLinks.map((l) => [l.student_reservation_id, l.id])
    );

    const { rows: reservations } = await pool.query<{
      id: string;
      tenant_name: string;
      room_no: string;
      property_name: string;
      lease_start: string;
      lease_end: string;
      monthly_rent: string;
      balance_remaining: string;
      advance_amount: string;
      deposit_amount: string;
      student_user_id: string;
    }>(
      `SELECT s.id,
              COALESCE(NULLIF(trim(u.full_name), ''), s.guest_name) AS tenant_name,
              r.room_no, p.name AS property_name,
              s.lease_start::text, s.lease_end::text,
              s.monthly_rent::text, s.balance_remaining::text, s.advance_amount::text,
              s.deposit_amount::text, s.student_user_id
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
       WHERE r.owner_user_id = $1::uuid AND s.status = 'Confirmed'
       ORDER BY s.lease_start DESC`,
      [ownerId]
    );

    const { rows: manualLeases } = await pool.query<{
      id: string;
      tenant_name: string;
      room_no: string;
      property_name: string;
      lease_start: string;
      lease_end: string;
      monthly_rate: string;
      student_reservation_id: string | null;
    }>(
      `SELECT l.id, l.tenant_name, r.room_no, p.name AS property_name,
              l.lease_start::text, l.lease_end::text,
              r.monthly_rate::text, l.student_reservation_id
       FROM public.landlord_tenant_leases l
       JOIN public.landlord_rooms r ON r.id = l.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE l.owner_user_id = $1::uuid
         AND l.student_reservation_id IS NULL
       ORDER BY l.lease_start DESC`,
      [ownerId]
    );

    const reservationIds = new Set(reservations.map((r) => r.id));

    const fromReservations = await Promise.all(
      reservations.map(async (res) => {
        await ensurePaymentDueDatesForReservation(pool, res.id);
        await reconcileScheduleWithPaidPayments(pool, { reservationId: res.id });
        const monthlySchedule = await fetchMonthlySchedule(pool, {
          reservationId: res.id,
        });
        const months = countLeaseMonths(
          new Date(res.lease_start),
          new Date(res.lease_end)
        );
        return buildRow({
          id: res.id,
          tenantName: res.tenant_name,
          roomNumber: res.room_no,
          propertyName: res.property_name,
          linkedLeaseId: leaseIdByReservation.get(res.id) ?? null,
          leaseStart: res.lease_start,
          leaseEnd: res.lease_end,
          months,
          monthlyRent: Number(res.monthly_rent),
          remainingBalance: Number(res.balance_remaining),
          advancePayments: Number(res.advance_amount),
          deposits: Number(res.deposit_amount),
          monthlySchedule,
          studentUserId: res.student_user_id,
          source: "reservation" as const,
        });
      })
    );

    const fromLeases = await Promise.all(
      manualLeases.map(async (l) => {
        await ensurePaymentDueDatesForLease(pool, l.id);
        await reconcileScheduleWithPaidPayments(pool, { leaseId: l.id });
        const monthlySchedule = await fetchMonthlySchedule(pool, {
          leaseId: l.id,
        });
        const months = countLeaseMonths(
          new Date(l.lease_start),
          new Date(l.lease_end)
        );
        const remaining = monthlySchedule
          .filter((m) => m.status !== "Paid")
          .reduce((s, m) => s + m.amount, 0);
        return buildRow({
          id: l.id,
          tenantName: l.tenant_name,
          roomNumber: l.room_no,
          propertyName: l.property_name,
          linkedLeaseId: l.id,
          leaseStart: l.lease_start,
          leaseEnd: l.lease_end,
          months,
          monthlyRent: Number(l.monthly_rate),
          remainingBalance: remaining,
          advancePayments: 0,
          deposits: 0,
          monthlySchedule,
          studentUserId: null,
          source: "lease" as const,
        });
      })
    );

    const linkedLeases = await pool.query<{
      id: string;
      student_reservation_id: string;
    }>(
      `SELECT id, student_reservation_id
       FROM public.landlord_tenant_leases
       WHERE owner_user_id = $1::uuid AND student_reservation_id IS NOT NULL`,
      [ownerId]
    );
    for (const l of linkedLeases.rows) {
      if (!reservationIds.has(l.student_reservation_id)) {
        await ensurePaymentDueDatesForLease(pool, l.id);
      }
    }

    const leasePaymentMonitoring = [...fromReservations, ...fromLeases].sort(
      (a, b) => a.tenantName.localeCompare(b.tenantName)
    );

    return NextResponse.json({ leasePaymentMonitoring });
  } catch (error) {
    console.error("Error loading lease payment monitoring:", error);
    return NextResponse.json(
      { error: "Failed to load lease payment monitoring" },
      { status: 500 }
    );
  }
}

function buildRow(input: {
  id: string;
  tenantName: string;
  roomNumber: string;
  propertyName: string;
  linkedLeaseId: string | null;
  leaseStart: string;
  leaseEnd: string;
  months: number;
  monthlyRent: number;
  remainingBalance: number;
  advancePayments: number;
  deposits: number;
  monthlySchedule: {
    monthNumber: number;
    dueDate: string;
    status: "Paid" | "Not Yet Paid";
    amount: number;
    paidDate?: string;
    reminderSentAt?: string;
  }[];
  studentUserId: string | null;
  source: "reservation" | "lease";
}) {
  const nextUnpaid = input.monthlySchedule.find((m) => m.status !== "Paid");
  return {
    id: input.id,
    tenantName: input.tenantName,
    roomNumber: input.roomNumber,
    propertyName: input.propertyName,
    linkedLeaseId: input.linkedLeaseId,
    nextUnpaidMonthNumber: nextUnpaid?.monthNumber ?? null,
    nextUnpaidReminderSent: Boolean(nextUnpaid?.reminderSentAt),
    leaseDuration:
      input.months === 1 ? "1 month" : `${input.months} months`,
    monthlyRent: input.monthlyRent,
    leaseStartDate: input.leaseStart,
    leaseEndDate: input.leaseEnd,
    remainingBalance: input.remainingBalance,
    advancePayments: input.advancePayments,
    deposits: input.deposits,
    monthlySchedule: input.monthlySchedule,
    studentUserId: input.studentUserId,
    source: input.source,
  };
}
