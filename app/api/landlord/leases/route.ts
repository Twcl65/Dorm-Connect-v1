import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  ensureLandlordProperty,
  landlordLog,
  resolveDormDisplayName,
} from "@/lib/landlord-db";
import {
  countLeaseMonths,
  deriveTenantPaymentStatusFromSchedule,
  ensurePaymentDueDatesForLease,
  ensurePaymentDueDatesForReservation,
  fetchMonthlySchedule,
  isRentDueAttention,
  isRentDueCritical,
  reconcileScheduleWithPaidPayments,
  resolveNextUnpaidDueFromSchedule,
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
    await ensureLandlordProperty(pool, ownerId);

    const { rows } = await pool.query<{
      id: string;
      room_no: string;
      tenant_name: string;
      lease_start: string;
      lease_end: string;
      payment_status: string;
      email: string | null;
      phone: string | null;
      property_name: string;
      student_reservation_id: string | null;
    }>(
      `SELECT l.id, r.room_no, l.tenant_name,
              l.lease_start::text, l.lease_end::text, l.payment_status,
              l.email, l.phone, p.name AS property_name,
              active_reservation.id AS student_reservation_id
       FROM public.landlord_tenant_leases l
       JOIN public.landlord_rooms r ON r.id = l.room_id
       JOIN public.landlord_properties p ON p.id = l.property_id
       LEFT JOIN public.student_dorm_reservations linked_reservation
         ON linked_reservation.id = l.student_reservation_id
       LEFT JOIN LATERAL (
         SELECT s.id
         FROM public.student_dorm_reservations s
         LEFT JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
         WHERE s.room_id = l.room_id
           AND s.status <> 'MoveOut'
           AND (
             s.id = l.student_reservation_id
             OR (
               l.student_reservation_id IS NOT NULL
               AND s.status IN ('Pending', 'Confirmed')
               AND (
                 s.student_user_id = linked_reservation.student_user_id
                 OR (l.email IS NOT NULL AND lower(trim(u.email)) = lower(trim(l.email)))
                 OR lower(trim(s.guest_name)) = lower(trim(l.tenant_name))
                 OR lower(trim(u.full_name)) = lower(trim(l.tenant_name))
               )
             )
           )
         ORDER BY (s.status = 'Confirmed') DESC, s.created_at DESC,
                  (s.id = l.student_reservation_id) DESC
         LIMIT 1
       ) active_reservation ON true
       WHERE l.owner_user_id = $1::uuid
         AND l.payment_status <> 'Completed'
         AND (l.student_reservation_id IS NULL OR active_reservation.id IS NOT NULL)
       ORDER BY r.room_no`,
      [ownerId]
    );

    const formatPeriod = (a: string, b: string) =>
      `${new Date(a).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${new Date(b).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;

    const { rows: pn } = await pool.query<{
      name: string;
      acc_dorm_name: string | null;
    }>(
      `SELECT p.name,
              (SELECT a.dorm_name FROM public.landlord_accreditation_requests a
               WHERE (a.property_id = p.id OR a.owner_user_id = p.owner_user_id)
                 AND trim(a.dorm_name) <> ''
               ORDER BY a.submitted_at DESC
               LIMIT 1) AS acc_dorm_name
       FROM public.landlord_properties p
       WHERE p.owner_user_id = $1::uuid
       ORDER BY p.created_at ASC
       LIMIT 1`,
      [ownerId]
    );
    const propertyName = resolveDormDisplayName(
      pn[0]?.name,
      pn[0]?.acc_dorm_name ?? null
    );

    const leases = await Promise.all(
      rows.map(async (r) => {
        const linkedResId = r.student_reservation_id;
        if (linkedResId) {
          await ensurePaymentDueDatesForReservation(pool, linkedResId);
          await reconcileScheduleWithPaidPayments(pool, {
            reservationId: linkedResId,
          });
        } else {
          await ensurePaymentDueDatesForLease(pool, r.id);
          await reconcileScheduleWithPaidPayments(pool, { leaseId: r.id });
        }
        const monthlySchedule = linkedResId
          ? await fetchMonthlySchedule(pool, { reservationId: linkedResId })
          : await fetchMonthlySchedule(pool, { leaseId: r.id });
        const paidMonths = monthlySchedule.filter((m) => m.status === "Paid").length;
        const totalMonths = monthlySchedule.length;
        const paymentStatus = deriveTenantPaymentStatusFromSchedule(
          monthlySchedule,
          r.payment_status as "Paid" | "Pending" | "Overdue"
        );
        const nextDue = resolveNextUnpaidDueFromSchedule(monthlySchedule);

        // Fetch balances and lease extension from linked student reservation (if any)
        let advancePayments = 0;
        let deposits = 0;
        let remainingBalance = 0;
        let leaseExtension = null;
        
        if (linkedResId) {
          const { rows: resData } = await pool.query<{
            advance_amount: string;
            deposit_amount: string;
            balance_remaining: string;
            lease_extension_status: string | null;
            lease_extension_requested_end: string | null;
          }>(
            `SELECT advance_amount::text, deposit_amount::text, balance_remaining::text,
                    lease_extension_status, lease_extension_requested_end::text
             FROM public.student_dorm_reservations WHERE id = $1::uuid`,
            [linkedResId]
          );
          if (resData[0]) {
            advancePayments = Number(resData[0].advance_amount) || 0;
            deposits = Number(resData[0].deposit_amount) || 0;
            remainingBalance = Number(resData[0].balance_remaining) || 0;
            const { mapLeaseExtension } = await import("@/lib/lease-extension");
            leaseExtension = mapLeaseExtension(
              resData[0].lease_extension_status,
              resData[0].lease_extension_requested_end
            );
          }
        } else {
          // For manual leases without a reservation, calculate remaining from schedule
          remainingBalance = monthlySchedule
            .filter((m) => m.status !== "Paid")
            .reduce((s, m) => s + m.amount, 0);
        }

        return {
          id: r.id,
          roomNo: r.room_no,
          name: r.tenant_name,
          propertyName: r.property_name,
          leaseStart: r.lease_start.slice(0, 10),
          leaseEnd: r.lease_end.slice(0, 10),
          leasePeriod: formatPeriod(r.lease_start, r.lease_end),
          leaseDuration:
            countLeaseMonths(new Date(r.lease_start), new Date(r.lease_end)) === 1
              ? "1 month"
              : `${countLeaseMonths(new Date(r.lease_start), new Date(r.lease_end))} months`,
          paymentStatus,
          email: r.email ?? undefined,
          contact: r.phone ?? undefined,
          monthlySchedule,
          paidMonths,
          totalMonths,
          nextDueDate: nextDue.nextDueDate,
          nextDueAmount: nextDue.nextDueAmount,
          daysUntilDue: nextDue.daysUntilDue,
          dueUrgency: nextDue.urgency,
          dueLabel: nextDue.dueLabel,
          advancePayments,
          deposits,
          remainingBalance,
          leaseExtension,
          reservationId: linkedResId,
        };
      })
    );

    const upcomingDue = leases
      .filter((t) => isRentDueAttention(t.dueUrgency))
      .sort((a, b) => (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999));

    return NextResponse.json({
      propertyName,
      leases,
      upcomingDue,
      stats: {
        total: leases.length,
        activeLeases: leases.length,
        paid: leases.filter((x) => x.paymentStatus === "Paid").length,
        pending: leases.filter((x) => x.paymentStatus === "Pending").length,
        overdue: leases.filter((x) => x.paymentStatus === "Overdue").length,
        dueSoon: leases.filter((x) => isRentDueCritical(x.dueUrgency)).length,
        dueThisWeek: leases.filter(
          (x) =>
            x.dueUrgency === "due_this_week" ||
            x.dueUrgency === "due_soon" ||
            x.dueUrgency === "due_today"
        ).length,
        upcomingCount: upcomingDue.length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load leases";
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
      tenantName?: string;
      email?: string;
      phone?: string;
      leaseStart?: string;
      leaseEnd?: string;
      paymentStatus?: string;
      remarks?: string;
    };
    const roomNo = (body.roomNo ?? "").trim();
    const tenantName = (body.tenantName ?? "").trim();
    if (!roomNo || !tenantName) {
      return NextResponse.json(
        { error: "Room number and tenant name are required." },
        { status: 400 }
      );
    }
    const leaseStart = body.leaseStart;
    const leaseEnd = body.leaseEnd;
    if (!leaseStart || !leaseEnd) {
      return NextResponse.json(
        { error: "Lease start and end dates are required." },
        { status: 400 }
      );
    }
    const ps =
      body.paymentStatus === "Paid" ||
      body.paymentStatus === "Pending" ||
      body.paymentStatus === "Overdue"
        ? body.paymentStatus
        : "Pending";

    const pool = await getPool();
    const propertyId = await ensureLandlordProperty(pool, ownerId);

    const { rows: rrows } = await pool.query<{ id: string }>(
      `SELECT id FROM public.landlord_rooms
       WHERE owner_user_id = $1::uuid AND property_id = $2::uuid AND room_no = $3`,
      [ownerId, propertyId, roomNo]
    );
    const roomId = rrows[0]?.id;
    if (!roomId) {
      return NextResponse.json(
        { error: `Room ${roomNo} not found. Add the room first.` },
        { status: 404 }
      );
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.landlord_tenant_leases
        (owner_user_id, property_id, room_id, tenant_name, email, phone,
         lease_start, lease_end, payment_status, remarks)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::date, $8::date, $9, $10)
       RETURNING id`,
      [
        ownerId,
        propertyId,
        roomId,
        tenantName,
        (body.email ?? "").trim() || null,
        (body.phone ?? "").trim() || null,
        leaseStart,
        leaseEnd,
        ps,
        (body.remarks ?? "").trim() || null,
      ]
    );

    await pool.query(
      `UPDATE public.landlord_rooms SET status = 'Occupied', updated_at = now()
       WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
      [roomId, ownerId]
    );

    const leaseId = rows[0]?.id;
    if (leaseId) {
      const { reconcileScheduleWithPaidPayments } =
        await import("@/lib/payment-schedule");
      await reconcileScheduleWithPaidPayments(pool, { leaseId });
    }

    await landlordLog(pool, ownerId, `Added tenant ${tenantName} to room ${roomNo}`);
    return NextResponse.json({ id: leaseId }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create lease";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
