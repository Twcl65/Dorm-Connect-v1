import type { Pool } from "pg";

export type MonthlyDueRow = {
  id: string;
  monthNumber: number;
  dueDate: string;
  status: "Paid" | "Not Yet Paid";
  amount: number;
  paidDate?: string;
  reminderSentAt?: string;
};

export type LeasePaymentStatus = "Paid" | "Pending" | "Overdue";

/**
 * Payment status for the tenant list: based on the current billing month in the
 * monthly schedule (paid in Payments monitoring), not only the lease row flag.
 */
export function deriveTenantPaymentStatusFromSchedule(
  schedule: MonthlyDueRow[],
  fallback: LeasePaymentStatus = "Pending"
): LeasePaymentStatus {
  if (schedule.length === 0) return fallback;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayStr = toDateStr(today);
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const row =
    schedule.find((m) => m.dueDate.slice(0, 7) === ym) ??
    schedule.find((m) => m.dueDate >= todayStr) ??
    schedule.filter((m) => m.dueDate <= todayStr).pop() ??
    schedule[0];

  if (row.status === "Paid") return "Paid";
  if (row.dueDate < todayStr) return "Overdue";
  return "Pending";
}

/** How urgent the next unpaid rent due date is (from monthly schedule). */
export type DueUrgency =
  | "paid"
  | "overdue"
  | "due_today"
  | "due_soon"
  | "due_this_week"
  | "upcoming";

export type NextDueInfo = {
  nextDueDate: string | null;
  nextDueAmount: number | null;
  daysUntilDue: number | null;
  urgency: DueUrgency;
  monthNumber: number | null;
  dueLabel: string | null;
};

const DUE_SOON_DAYS = 3;
const DUE_THIS_WEEK_DAYS = 7;

/** Earliest unpaid month on the schedule (e.g. May 19, then Jun 19). */
export function resolveNextUnpaidDueFromSchedule(
  schedule: MonthlyDueRow[]
): NextDueInfo {
  const empty: NextDueInfo = {
    nextDueDate: null,
    nextDueAmount: null,
    daysUntilDue: null,
    urgency: "paid",
    monthNumber: null,
    dueLabel: null,
  };
  if (schedule.length === 0) return empty;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const unpaid = schedule
    .filter((m) => m.status !== "Paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (unpaid.length === 0) return empty;

  const next = unpaid[0]!;
  const dueStr = next.dueDate.slice(0, 10);
  const due = new Date(`${dueStr}T12:00:00`);
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );

  let urgency: DueUrgency;
  if (diffDays < 0) urgency = "overdue";
  else if (diffDays === 0) urgency = "due_today";
  else if (diffDays <= DUE_SOON_DAYS) urgency = "due_soon";
  else if (diffDays <= DUE_THIS_WEEK_DAYS) urgency = "due_this_week";
  else urgency = "upcoming";

  return {
    nextDueDate: dueStr,
    nextDueAmount: next.amount,
    daysUntilDue: diffDays,
    urgency,
    monthNumber: next.monthNumber,
    dueLabel: formatRentDueLabel(dueStr, diffDays),
  };
}

export type UnpaidScheduleMonth = {
  dueDate: string;
  amount: number;
  monthNumber: number;
  monthLabel: string;
  dueLabel: string;
};

/** All unpaid months on the schedule, earliest first (skips paid months). */
export function resolveUpcomingUnpaidMonthsFromSchedule(
  schedule: MonthlyDueRow[]
): UnpaidScheduleMonth[] {
  if (schedule.length === 0) return [];

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return schedule
    .filter((m) => m.status !== "Paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((m) => {
      const dueStr = m.dueDate.slice(0, 10);
      const due = new Date(`${dueStr}T12:00:00`);
      const diffDays = Math.round(
        (due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
      );
      const monthLabel = due.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      return {
        dueDate: dueStr,
        amount: m.amount,
        monthNumber: m.monthNumber,
        monthLabel,
        dueLabel: formatRentDueLabel(dueStr, diffDays),
      };
    });
}

export function buildStudentPaymentReminderHint(
  unpaidMonths: UnpaidScheduleMonth[],
  dormName?: string | null
): string {
  if (unpaidMonths.length === 0) {
    return "All scheduled rent months are paid. Thank you!";
  }
  const labels = unpaidMonths.map((m) => m.monthLabel).join(", ");
  const prefix = dormName?.trim()
    ? `Upcoming rent for ${dormName.trim()}`
    : "Upcoming rent due";
  return `${prefix}: ${labels}`;
}

export function formatRentDueLabel(dueStr: string, diffDays: number): string {
  const formatted = new Date(`${dueStr}T12:00:00`).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric" }
  );
  if (diffDays < 0) {
    const daysLate = Math.abs(diffDays);
    return daysLate === 1
      ? `Overdue 1 day (${formatted})`
      : `Overdue ${daysLate} days (${formatted})`;
  }
  if (diffDays === 0) return `Due today · ${formatted}`;
  if (diffDays === 1) return `Due tomorrow · ${formatted}`;
  return `Due in ${diffDays} days · ${formatted}`;
}

export function isRentDueAttention(urgency: DueUrgency): boolean {
  return (
    urgency === "overdue" ||
    urgency === "due_today" ||
    urgency === "due_soon" ||
    urgency === "due_this_week"
  );
}

export function isRentDueCritical(urgency: DueUrgency): boolean {
  return (
    urgency === "overdue" ||
    urgency === "due_today" ||
    urgency === "due_soon"
  );
}

export type MonthRentDisplayStatus = "Paid" | "Not Yet Paid" | "Overdue";

/** Index of the billing month that applies today (calendar month, then nearest). */
export function resolveCurrentScheduleMonthIndex(
  schedule: MonthlyDueRow[]
): number {
  if (schedule.length === 0) return -1;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayStr = toDateStr(today);
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const byYm = schedule.findIndex((m) => m.dueDate.slice(0, 7) === ym);
  if (byYm >= 0) return byYm;

  const upcoming = schedule.findIndex((m) => m.dueDate >= todayStr);
  if (upcoming >= 0) return upcoming;

  return schedule.length - 1;
}

function monthRowDisplayStatus(
  row: MonthlyDueRow,
  todayStr: string
): MonthRentDisplayStatus {
  if (row.status === "Paid") return "Paid";
  if (row.dueDate < todayStr) return "Overdue";
  return "Not Yet Paid";
}

/** Landlord reservations: current month rent + next month when on a payment schedule. */
export function formatReservationRentStatus(
  schedule: MonthlyDueRow[]
): string | null {
  if (schedule.length === 0) return null;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayStr = toDateStr(today);
  const idx = resolveCurrentScheduleMonthIndex(schedule);
  if (idx < 0) return null;

  const current = schedule[idx]!;
  const parts = [`This month: ${monthRowDisplayStatus(current, todayStr)}`];

  const next = schedule[idx + 1];
  if (next) {
    parts.push(
      `Next: ${next.status === "Paid" ? "Paid" : "Not Yet Paid"}`
    );
  }

  return parts.join(" · ");
}

/** Inclusive month count between lease start and end. */
export function countLeaseMonths(leaseStart: Date, leaseEnd: Date): number {
  const s = new Date(leaseStart);
  const e = new Date(leaseEnd);
  s.setHours(12, 0, 0, 0);
  e.setHours(12, 0, 0, 0);
  let months =
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
  if (months < 1) months = 1;
  return months;
}

function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type ScheduleTarget = {
  reservationId: string | null;
  leaseId: string | null;
};

/** Due dates for student-linked leases live on the reservation row. */
export async function resolveScheduleTarget(
  pool: Pool,
  opts: { reservationId?: string | null; leaseId?: string | null }
): Promise<ScheduleTarget> {
  if (opts.reservationId) {
    return { reservationId: opts.reservationId, leaseId: opts.leaseId ?? null };
  }
  if (!opts.leaseId) {
    return { reservationId: null, leaseId: null };
  }
  const { rows } = await pool.query<{ student_reservation_id: string | null }>(
    `SELECT student_reservation_id FROM public.landlord_tenant_leases WHERE id = $1::uuid`,
    [opts.leaseId]
  );
  const reservationId = rows[0]?.student_reservation_id ?? null;
  return {
    reservationId,
    leaseId: reservationId ? null : opts.leaseId,
  };
}

/** Move-in total = 1st month rent + 1 month advance + 1 month security deposit. */
export function isInitialMoveInPayment(
  amount: number,
  monthlyRent: number
): boolean {
  if (monthlyRent <= 0 || amount <= 0) return false;
  const expected = monthlyRent * 3;
  return amount >= expected - 0.01;
}

type PaidPaymentRow = { amount: number; paidOn: string | null };

async function fetchPaidPaymentsForTarget(
  pool: Pool,
  target: ScheduleTarget
): Promise<PaidPaymentRow[]> {
  const payments: PaidPaymentRow[] = [];

  if (target.reservationId) {
    const { rows: resRows } = await pool.query<{
      room_id: string;
      guest_name: string;
    }>(
      `SELECT room_id, guest_name FROM public.student_dorm_reservations WHERE id = $1::uuid`,
      [target.reservationId]
    );
    const res = resRows[0];

    const { rows: studentPay } = await pool.query<{
      amount: string;
      paid_at: Date | null;
      created_at: Date;
    }>(
      `SELECT amount::text, paid_at, created_at
       FROM public.student_payment_records
       WHERE reservation_id = $1::uuid AND status = 'Paid'
       ORDER BY COALESCE(paid_at, created_at) ASC`,
      [target.reservationId]
    );
    for (const p of studentPay) {
      payments.push({
        amount: Number(p.amount),
        paidOn: (p.paid_at ?? p.created_at)?.toISOString().slice(0, 10) ?? null,
      });
    }

    if (res) {
      const { rows: landlordPay } = await pool.query<{
        amount: string;
        paid_on: string | null;
        created_at: Date;
      }>(
        `SELECT amount::text, paid_on::text, created_at
         FROM public.landlord_payments
         WHERE room_id = $1::uuid AND status = 'Paid'
           AND lower(trim(payer_name)) = lower(trim($2))
           AND (entry_source IS NULL OR entry_source = 'manual')
         ORDER BY COALESCE(paid_on, created_at::date) ASC`,
        [res.room_id, res.guest_name]
      );
      for (const p of landlordPay) {
        payments.push({
          amount: Number(p.amount),
          paidOn: p.paid_on?.slice(0, 10) ?? p.created_at.toISOString().slice(0, 10),
        });
      }
    }
  } else if (target.leaseId) {
    const { rows: leaseRows } = await pool.query<{
      room_id: string;
      tenant_name: string;
      owner_user_id: string;
    }>(
      `SELECT room_id, tenant_name, owner_user_id
       FROM public.landlord_tenant_leases WHERE id = $1::uuid`,
      [target.leaseId]
    );
    const lease = leaseRows[0];
    if (lease) {
      const { rows: landlordPay } = await pool.query<{
        amount: string;
        paid_on: string | null;
        created_at: Date;
      }>(
        `SELECT amount::text, paid_on::text, created_at
         FROM public.landlord_payments
         WHERE owner_user_id = $1::uuid AND room_id = $2::uuid AND status = 'Paid'
           AND lower(trim(payer_name)) = lower(trim($3))
           AND (entry_source IS NULL OR entry_source = 'manual')
         ORDER BY COALESCE(paid_on, created_at::date) ASC`,
        [lease.owner_user_id, lease.room_id, lease.tenant_name]
      );
      for (const p of landlordPay) {
        payments.push({
          amount: Number(p.amount),
          paidOn: p.paid_on?.slice(0, 10) ?? p.created_at.toISOString().slice(0, 10),
        });
      }
    }
  }

  return payments.sort((a, b) => (a.paidOn ?? "").localeCompare(b.paidOn ?? ""));
}

async function getMonthlyRentForTarget(
  pool: Pool,
  target: ScheduleTarget
): Promise<number> {
  if (target.reservationId) {
    const { rows } = await pool.query<{ monthly_rent: string }>(
      `SELECT monthly_rent::text FROM public.student_dorm_reservations WHERE id = $1::uuid`,
      [target.reservationId]
    );
    return Number(rows[0]?.monthly_rent ?? 0);
  }
  if (target.leaseId) {
    const { rows } = await pool.query<{ monthly_rate: string }>(
      `SELECT COALESCE(r.monthly_rate, 0)::text AS monthly_rate
       FROM public.landlord_tenant_leases l
       JOIN public.landlord_rooms r ON r.id = l.room_id
       WHERE l.id = $1::uuid`,
      [target.leaseId]
    );
    return Number(rows[0]?.monthly_rate ?? 0);
  }
  return 0;
}

/**
 * How many lease months are covered by rent (not advance/deposit).
 * ₱6,300 at ₱2,100/mo = 1 paid month + advance + deposit.
 */
async function computePaidRentMonthsFromPayments(
  pool: Pool,
  target: ScheduleTarget
): Promise<number> {
  const monthlyRent = await getMonthlyRentForTarget(pool, target);
  if (monthlyRent <= 0) return 0;

  const payments = await fetchPaidPaymentsForTarget(pool, target);
  let rentMonthsCovered = 0;

  for (const p of payments) {
    if (isInitialMoveInPayment(p.amount, monthlyRent)) {
      rentMonthsCovered = Math.max(rentMonthsCovered, 1);
      continue;
    }
    if (p.amount >= monthlyRent - 0.01) {
      rentMonthsCovered += Math.max(1, Math.floor((p.amount + 0.01) / monthlyRent));
    }
  }

  if (target.reservationId) {
    const { rows } = await pool.query<{ rent_payment_status: string }>(
      `SELECT rent_payment_status FROM public.student_dorm_reservations WHERE id = $1::uuid`,
      [target.reservationId]
    );
    if (rows[0]?.rent_payment_status === "Paid" && rentMonthsCovered < 1) {
      rentMonthsCovered = 1;
    }
  } else if (target.leaseId) {
    const { rows } = await pool.query<{ payment_status: string }>(
      `SELECT payment_status FROM public.landlord_tenant_leases WHERE id = $1::uuid`,
      [target.leaseId]
    );
    if (rows[0]?.payment_status === "Paid" && rentMonthsCovered < 1) {
      rentMonthsCovered = 1;
    }
  }

  const schedule = await fetchMonthlySchedule(pool, {
    reservationId: target.reservationId ?? undefined,
    leaseId: target.leaseId ?? undefined,
  });
  return Math.min(rentMonthsCovered, Math.max(schedule.length, 1));
}

/**
 * Seed advance + deposit buckets once after move-in (3× monthly rent) is paid.
 * Does not overwrite balances reduced via "use this as payment" (apply-credit).
 */
async function syncMoveInAdvanceAndDeposit(
  pool: Pool,
  reservationId: string,
  monthlyRent: number
): Promise<void> {
  if (monthlyRent <= 0) return;

  const payments = await fetchPaidPaymentsForTarget(pool, {
    reservationId,
    leaseId: null,
  });
  const hasMoveIn = payments.some((p) =>
    isInitialMoveInPayment(p.amount, monthlyRent)
  );
  if (!hasMoveIn) return;

  const { rows: resRows } = await pool.query<{
    advance_amount: string;
    deposit_amount: string;
  }>(
    `SELECT advance_amount::text, deposit_amount::text
     FROM public.student_dorm_reservations
     WHERE id = $1::uuid`,
    [reservationId]
  );
  const advance = Number(resRows[0]?.advance_amount ?? 0);
  const deposit = Number(resRows[0]?.deposit_amount ?? 0);

  // Buckets already set or partially used (landlord apply-credit).
  if (advance > 0.01 || deposit > 0.01) return;

  // Both buckets exhausted via credit — do not restore on refresh.
  const { rows: paidBeyondFirst } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
     FROM public.payment_due_dates
     WHERE reservation_id = $1::uuid
       AND status = 'Paid'
       AND month_number > 1`,
    [reservationId]
  );
  if (Number(paidBeyondFirst[0]?.c ?? 0) > 0) return;

  const moveInTotal = monthlyRent * 3;
  await pool.query(
    `UPDATE public.student_dorm_reservations
     SET advance_amount = $1,
         deposit_amount = $1,
         initial_payment_required = $2,
         initial_payment_received = GREATEST(COALESCE(initial_payment_received, 0), $2),
         updated_at = now()
     WHERE id = $3::uuid`,
    [monthlyRent, moveInTotal, reservationId]
  );
}

/**
 * Align schedule with paid amounts: move-in (3× rent) = month 1 only + advance/deposit.
 */
export async function reconcileScheduleWithPaidPayments(
  pool: Pool,
  opts: { reservationId?: string | null; leaseId?: string | null }
): Promise<void> {
  const target = await resolveScheduleTarget(pool, opts);
  if (!target.reservationId && !target.leaseId) return;

  if (target.reservationId) {
    await ensurePaymentDueDatesForReservation(pool, target.reservationId);
  } else if (target.leaseId) {
    await ensurePaymentDueDatesForLease(pool, target.leaseId);
  }

  const monthlyRent = await getMonthlyRentForTarget(pool, target);
  if (target.reservationId && monthlyRent > 0) {
    await syncMoveInAdvanceAndDeposit(pool, target.reservationId, monthlyRent);
  }

  const targetPaidMonths = await computePaidRentMonthsFromPayments(pool, target);
  if (targetPaidMonths < 1) return;

  const schedule = await fetchMonthlySchedule(pool, {
    reservationId: target.reservationId ?? undefined,
    leaseId: target.leaseId ?? undefined,
  });
  const paidOnSchedule = schedule.filter((m) => m.status === "Paid").length;
  const toApply = targetPaidMonths - paidOnSchedule;

  for (let i = 0; i < toApply; i++) {
    await applyPaidRentToSchedule(pool, {
      reservationId: target.reservationId,
      leaseId: target.leaseId,
    });
  }

  if (target.reservationId) {
    await recomputeReservationBalances(pool, target.reservationId);
  } else if (target.leaseId) {
    await syncLeasePaymentStatusFromSchedule(pool, target.leaseId);
  }
}

export async function ensurePaymentDueDatesForReservation(
  pool: Pool,
  reservationId: string
): Promise<void> {
  const { rows } = await pool.query<{
    lease_start: Date;
    lease_end: Date;
    monthly_rent: string;
  }>(
    `SELECT lease_start, lease_end, monthly_rent::text
     FROM public.student_dorm_reservations WHERE id = $1::uuid`,
    [reservationId]
  );
  const r = rows[0];
  if (!r) return;

  const monthlyRent = Number(r.monthly_rent) || 0;
  const months = countLeaseMonths(r.lease_start, r.lease_end);
  const start = new Date(r.lease_start);
  start.setHours(12, 0, 0, 0);

  const { rows: existing } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM public.payment_due_dates WHERE reservation_id = $1::uuid`,
    [reservationId]
  );
  if (Number(existing[0]?.c ?? 0) > 0) return;

  for (let m = 1; m <= months; m++) {
    const due = addMonthsUtc(start, m - 1);
    await pool.query(
      `INSERT INTO public.payment_due_dates
        (reservation_id, month_number, due_date, status, amount_due)
       VALUES ($1::uuid, $2, $3::date, 'Not Yet Paid', $4)`,
      [reservationId, m, toDateStr(due), monthlyRent]
    );
  }
}

export async function ensurePaymentDueDatesForLease(
  pool: Pool,
  leaseId: string
): Promise<void> {
  const { rows } = await pool.query<{
    lease_start: Date;
    lease_end: Date;
    monthly_rate: string;
    student_reservation_id: string | null;
  }>(
    `SELECT l.lease_start, l.lease_end, COALESCE(r.monthly_rate, 0)::text AS monthly_rate,
            l.student_reservation_id
     FROM public.landlord_tenant_leases l
     JOIN public.landlord_rooms r ON r.id = l.room_id
     WHERE l.id = $1::uuid`,
    [leaseId]
  );
  const r = rows[0];
  if (!r) return;
  if (r.student_reservation_id) {
    await ensurePaymentDueDatesForReservation(pool, r.student_reservation_id);
    return;
  }

  const monthlyRent = Number(r.monthly_rate) || 0;
  const months = countLeaseMonths(r.lease_start, r.lease_end);
  const start = new Date(r.lease_start);
  start.setHours(12, 0, 0, 0);

  const { rows: existing } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM public.payment_due_dates WHERE tenant_lease_id = $1::uuid`,
    [leaseId]
  );
  if (Number(existing[0]?.c ?? 0) > 0) return;

  for (let m = 1; m <= months; m++) {
    const due = addMonthsUtc(start, m - 1);
    await pool.query(
      `INSERT INTO public.payment_due_dates
        (tenant_lease_id, month_number, due_date, status, amount_due)
       VALUES ($1::uuid, $2, $3::date, 'Not Yet Paid', $4)`,
      [leaseId, m, toDateStr(due), monthlyRent]
    );
  }
}

export async function fetchMonthlySchedule(
  pool: Pool,
  opts: { reservationId?: string; leaseId?: string }
): Promise<MonthlyDueRow[]> {
  const where = opts.reservationId
    ? `reservation_id = $1::uuid`
    : `tenant_lease_id = $1::uuid`;
  const id = opts.reservationId ?? opts.leaseId;
  if (!id) return [];

  const { rows } = await pool.query<{
    id: string;
    month_number: number;
    due_date: string;
    status: string;
    amount_due: string;
    paid_date: string | null;
    reminder_sent_at: Date | null;
  }>(
    `SELECT id, month_number, due_date::text, status, amount_due::text, paid_date::text,
            reminder_sent_at
     FROM public.payment_due_dates
     WHERE ${where}
     ORDER BY month_number ASC`,
    [id]
  );

  return rows.map((d) => ({
    id: d.id,
    monthNumber: d.month_number,
    dueDate: d.due_date,
    status: d.status as "Paid" | "Not Yet Paid",
    amount: Number(d.amount_due),
    paidDate: d.paid_date ?? undefined,
    reminderSentAt: d.reminder_sent_at?.toISOString(),
  }));
}

/** Apply advance or security deposit balance to pay a specific lease month. */
export async function applyScheduleCreditForMonth(
  pool: Pool,
  opts: {
    reservationId?: string | null;
    leaseId?: string | null;
    monthNumber: number;
    fundSource: "advance" | "deposit";
    paidOn?: string | null;
  }
): Promise<{ advanceRemaining: number; depositRemaining: number }> {
  const target = await resolveScheduleTarget(pool, opts);
  if (!target.reservationId) {
    throw new Error(
      "Advance and security deposit can only be applied for tenants linked to a student reservation."
    );
  }

  const reservationId = target.reservationId;
  await ensurePaymentDueDatesForReservation(pool, reservationId);

  const { rows: resRows } = await pool.query<{
    monthly_rent: string;
    advance_amount: string;
    deposit_amount: string;
  }>(
    `SELECT monthly_rent::text, advance_amount::text, deposit_amount::text
     FROM public.student_dorm_reservations WHERE id = $1::uuid`,
    [reservationId]
  );
  const res = resRows[0];
  if (!res) throw new Error("Reservation not found.");

  const monthlyRent = Number(res.monthly_rent) || 0;
  let advance = Number(res.advance_amount) || 0;
  let deposit = Number(res.deposit_amount) || 0;

  const { rows: dueRows } = await pool.query<{
    status: string;
    amount_due: string;
  }>(
    `SELECT status, amount_due::text
     FROM public.payment_due_dates
     WHERE reservation_id = $1::uuid AND month_number = $2`,
    [reservationId, opts.monthNumber]
  );
  const due = dueRows[0];
  if (!due) throw new Error("Month not found on schedule.");
  if (due.status === "Paid") {
    throw new Error("This month is already marked as paid.");
  }

  const amountDue = Number(due.amount_due) || monthlyRent;
  if (amountDue <= 0) {
    throw new Error("Invalid amount for this month.");
  }

  if (opts.fundSource === "advance") {
    if (advance < amountDue - 0.01) {
      throw new Error(
        `Insufficient advance balance (₱${advance.toLocaleString()} available, ₱${amountDue.toLocaleString()} required).`
      );
    }
    advance = Math.round((advance - amountDue) * 100) / 100;
  } else {
    if (deposit < amountDue - 0.01) {
      throw new Error(
        `Insufficient security deposit (₱${deposit.toLocaleString()} available, ₱${amountDue.toLocaleString()} required).`
      );
    }
    deposit = Math.round((deposit - amountDue) * 100) / 100;
  }

  await pool.query(
    `UPDATE public.student_dorm_reservations
     SET advance_amount = $1,
         deposit_amount = $2,
         updated_at = now()
     WHERE id = $3::uuid`,
    [advance, deposit, reservationId]
  );

  await setScheduleMonthStatus(pool, {
    reservationId,
    monthNumber: opts.monthNumber,
    status: "Paid",
    paidOn: opts.paidOn,
  });

  await recomputeReservationBalances(pool, reservationId);

  await recordCreditLandlordPayment(pool, {
    reservationId,
    monthNumber: opts.monthNumber,
    fundSource: opts.fundSource,
    amount: amountDue,
    paidOn: opts.paidOn ?? toDateStr(new Date()),
  });

  return { advanceRemaining: advance, depositRemaining: deposit };
}

/** Ledger row when rent is paid from advance or security deposit (not cash). */
async function recordCreditLandlordPayment(
  pool: Pool,
  opts: {
    reservationId: string;
    monthNumber: number;
    fundSource: "advance" | "deposit";
    amount: number;
    paidOn: string;
  }
): Promise<void> {
  const { rows: ctx } = await pool.query<{
    owner_user_id: string;
    room_id: string;
    tenant_lease_id: string | null;
    payer_name: string;
  }>(
    `SELECT r.owner_user_id, s.room_id, ltl.id AS tenant_lease_id,
            COALESCE(NULLIF(trim(u.full_name), ''), s.guest_name) AS payer_name
     FROM public.student_dorm_reservations s
     JOIN public.landlord_rooms r ON r.id = s.room_id
     JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
     LEFT JOIN public.landlord_tenant_leases ltl
       ON ltl.student_reservation_id = s.id
     WHERE s.id = $1::uuid`,
    [opts.reservationId]
  );
  const row = ctx[0];
  if (!row) return;

  const { rows: existing } = await pool.query<{ id: string }>(
    `SELECT lp.id
     FROM public.landlord_payments lp
     LEFT JOIN public.landlord_tenant_leases ltl ON ltl.id = lp.tenant_lease_id
     WHERE lp.room_id = $1::uuid
       AND lp.schedule_month_number = $2
       AND lp.entry_source = $3
       AND (
         ltl.student_reservation_id = $4::uuid
         OR (ltl.id IS NULL AND lp.owner_user_id = $5::uuid)
       )
     LIMIT 1`,
    [
      row.room_id,
      opts.monthNumber,
      opts.fundSource,
      opts.reservationId,
      row.owner_user_id,
    ]
  );
  if (existing[0]) return;

  const refLabel =
    opts.fundSource === "advance"
      ? `Advance payment · Month ${opts.monthNumber}`
      : `Security deposit · Month ${opts.monthNumber}`;

  await pool.query(
    `INSERT INTO public.landlord_payments
      (owner_user_id, room_id, tenant_lease_id, payer_name, amount, method, status,
       reference_no, paid_on, entry_source, schedule_month_number)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, 'Cash', 'Paid', $6, $7::date, $8, $9)`,
    [
      row.owner_user_id,
      row.room_id,
      row.tenant_lease_id,
      row.payer_name,
      opts.amount,
      refLabel,
      opts.paidOn.slice(0, 10),
      opts.fundSource,
      opts.monthNumber,
    ]
  );
}

/** Landlord manual update for a single month on the rent schedule. */
export async function setScheduleMonthStatus(
  pool: Pool,
  opts: {
    reservationId?: string | null;
    leaseId?: string | null;
    monthNumber: number;
    status: "Paid" | "Not Yet Paid";
    paidOn?: string | null;
  }
): Promise<void> {
  const target = await resolveScheduleTarget(pool, opts);
  if (!target.reservationId && !target.leaseId) {
    throw new Error("Lease not found.");
  }

  if (target.reservationId) {
    await ensurePaymentDueDatesForReservation(pool, target.reservationId);
  } else if (target.leaseId) {
    await ensurePaymentDueDatesForLease(pool, target.leaseId);
  }

  const scheduleId = target.reservationId ?? target.leaseId;
  if (!scheduleId) return;

  const where = target.reservationId
    ? `reservation_id = $1::uuid`
    : `tenant_lease_id = $1::uuid`;

  const paidDate =
    opts.status === "Paid"
      ? opts.paidOn?.slice(0, 10) ?? toDateStr(new Date())
      : null;

  const { rowCount } = await pool.query(
    `UPDATE public.payment_due_dates
     SET status = $2,
         paid_date = $3::date,
         updated_at = now()
     WHERE ${where} AND month_number = $4`,
    [scheduleId, opts.status, paidDate, opts.monthNumber]
  );

  if ((rowCount ?? 0) < 1) {
    throw new Error("Month not found on schedule.");
  }

  if (target.reservationId) {
    await recomputeReservationBalances(pool, target.reservationId);
  } else if (target.leaseId) {
    await syncLeasePaymentStatusFromSchedule(pool, target.leaseId);
  }
}

/** Mark the next unpaid month when a rent payment is recorded as Paid. */
export async function applyPaidRentToSchedule(
  pool: Pool,
  opts: {
    reservationId?: string | null;
    leaseId?: string | null;
    paidOn?: string | null;
  }
): Promise<void> {
  const target = await resolveScheduleTarget(pool, opts);
  if (!target.reservationId && !target.leaseId) return;

  if (target.reservationId) {
    await ensurePaymentDueDatesForReservation(pool, target.reservationId);
  } else if (target.leaseId) {
    await ensurePaymentDueDatesForLease(pool, target.leaseId);
  }

  const where = target.reservationId
    ? `reservation_id = $1::uuid AND status = 'Not Yet Paid'`
    : `tenant_lease_id = $1::uuid AND status = 'Not Yet Paid'`;
  const id = target.reservationId ?? target.leaseId;
  if (!id) return;

  const paidDate = opts.paidOn?.slice(0, 10) ?? toDateStr(new Date());

  await pool.query(
    `UPDATE public.payment_due_dates
     SET status = 'Paid', paid_date = $2::date, updated_at = now()
     WHERE id = (
       SELECT id FROM public.payment_due_dates
       WHERE ${where}
       ORDER BY month_number ASC
       LIMIT 1
     )`,
    [id, paidDate]
  );

  if (target.reservationId) {
    await recomputeReservationBalances(pool, target.reservationId);
  } else if (target.leaseId) {
    await syncLeasePaymentStatusFromSchedule(pool, target.leaseId);
  }
}

export async function recomputeReservationBalances(
  pool: Pool,
  reservationId: string
): Promise<void> {
  const { rows: due } = await pool.query<{
    amount_due: string;
    due_date: string;
    status: string;
  }>(
    `SELECT amount_due::text, due_date::text, status
     FROM public.payment_due_dates
     WHERE reservation_id = $1::uuid
     ORDER BY month_number ASC`,
    [reservationId]
  );

  let remaining = 0;
  let nextDue: string | null = null;
  const today = toDateStr(new Date());

  for (const d of due) {
    if (d.status !== "Paid") {
      remaining += Number(d.amount_due);
      if (!nextDue) nextDue = d.due_date;
    }
  }

  const scheduleRows: MonthlyDueRow[] = due.map((d, i) => ({
    id: `m-${i}`,
    monthNumber: i + 1,
    dueDate: d.due_date,
    status: d.status as "Paid" | "Not Yet Paid",
    amount: Number(d.amount_due),
  }));
  const rentStatus = deriveTenantPaymentStatusFromSchedule(
    scheduleRows,
    "Pending"
  );

  await pool.query(
    `UPDATE public.student_dorm_reservations
     SET balance_remaining = $1,
         next_payment_due_date = $2::date,
         rent_payment_status = $3,
         updated_at = now()
     WHERE id = $4::uuid`,
    [remaining, nextDue, rentStatus, reservationId]
  );

  const { rows: lr } = await pool.query<{ id: string }>(
    `SELECT id FROM public.landlord_tenant_leases
     WHERE student_reservation_id = $1::uuid LIMIT 1`,
    [reservationId]
  );
  if (lr[0]) {
    const schedule = await fetchMonthlySchedule(pool, { reservationId });
    const leaseStatus = deriveTenantPaymentStatusFromSchedule(
      schedule,
      rentStatus as LeasePaymentStatus
    );
    await pool.query(
      `UPDATE public.landlord_tenant_leases
       SET payment_status = $1, updated_at = now()
       WHERE id = $2::uuid`,
      [leaseStatus, lr[0].id]
    );
  }
}

export async function syncLeasePaymentStatusFromSchedule(
  pool: Pool,
  leaseId: string
): Promise<void> {
  const target = await resolveScheduleTarget(pool, { leaseId });
  if (!target.reservationId && !target.leaseId) return;

  const schedule = await fetchMonthlySchedule(pool, {
    reservationId: target.reservationId ?? undefined,
    leaseId: target.leaseId ?? undefined,
  });
  if (schedule.length === 0) return;

  const { rows: cur } = await pool.query<{ payment_status: string }>(
    `SELECT payment_status FROM public.landlord_tenant_leases WHERE id = $1::uuid`,
    [leaseId]
  );
  const paymentStatus = deriveTenantPaymentStatusFromSchedule(
    schedule,
    (cur[0]?.payment_status as LeasePaymentStatus) ?? "Pending"
  );

  await pool.query(
    `UPDATE public.landlord_tenant_leases
     SET payment_status = $1, updated_at = now()
     WHERE id = $2::uuid`,
    [paymentStatus, leaseId]
  );
}

export async function resolveLeaseIdForRoom(
  pool: Pool,
  ownerId: string,
  roomId: string
): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM public.landlord_tenant_leases
     WHERE owner_user_id = $1::uuid AND room_id = $2::uuid
     ORDER BY lease_start DESC LIMIT 1`,
    [ownerId, roomId]
  );
  return rows[0]?.id ?? null;
}
