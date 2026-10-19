import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOwner } from "@/lib/require-owner";
import { buildPdfReport, buildIncomePdfReport } from "./_pdf";

export const dynamic = "force-dynamic";

function formatPhp(n: number): string {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function mapStudentPayStatus(s: string): "Paid" | "Pending" | "Overdue" {
  if (s === "Paid") return "Paid";
  if (s === "Failed") return "Overdue";
  return "Pending";
}

export async function GET(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;
  const isPdf = new URL(req.url).searchParams.get("pdf") === "true";

  try {
    const pool = await getPool();

    // All landlord payments (manual advance, deposit, rent)
    const { rows: landlordRows } = await pool.query<{
      id: string;
      amount: string;
      method: string;
      status: string;
      entry_source: string | null;
      paid_on: string | null;
      created_at: Date;
      payer_name: string;
      room_no: string | null;
      property_name: string | null;
      schedule_month_number: number | null;
      lease_start: string | null;
    }>(
      `SELECT p.id, p.amount::text, p.method, p.status, p.entry_source,
              p.paid_on::text, p.created_at, p.payer_name,
              r.room_no, prop.name AS property_name,
              p.schedule_month_number, COALESCE(l.student_reservation_id) AS lease_id,
              COALESCE(l.lease_start, s.lease_start, room_res.lease_start)::text AS lease_start
       FROM public.landlord_payments p
       LEFT JOIN public.landlord_rooms r ON r.id = p.room_id
       LEFT JOIN public.landlord_properties prop ON prop.id = r.property_id
       LEFT JOIN public.landlord_tenant_leases l ON l.id = p.tenant_lease_id
       LEFT JOIN public.student_dorm_reservations s ON s.id = l.student_reservation_id
       LEFT JOIN LATERAL (
         SELECT res.lease_start
         FROM public.student_dorm_reservations res
         WHERE res.room_id = p.room_id
           AND res.status = 'Confirmed'
         ORDER BY res.created_at DESC
         LIMIT 1
       ) room_res ON true
       WHERE p.owner_user_id = $1::uuid`,
      [ownerId]
    );

    // Student payments (monthly rent from student app)
    const { rows: studentRows } = await pool.query<{
      id: string;
      amount: string;
      method: string;
      status: string;
      created_at: Date;
      paid_at: Date | null;
      receipt_url: string | null;
      schedule_month_number: number | null;
      lease_start: string | null;
      property_name: string | null;
      room_no: string | null;
      payer_name: string;
      reservation_id: string;
      monthly_rent: string | null;
      room_monthly_rate: string | null;
      deposit_amount: string | null;
      advance_amount: string | null;
      payment_rank: number | null;
    }>(
      `SELECT pay.id, pay.amount::text, pay.method, pay.status,
              pay.created_at, pay.paid_at, pay.receipt_url,
              pay.schedule_month_number, s.lease_start::text AS lease_start,
              p.name AS property_name, r.room_no,
              r.monthly_rate::text AS room_monthly_rate,
              stu.full_name AS payer_name, pay.reservation_id,
              s.monthly_rent::text, s.deposit_amount::text, s.advance_amount::text,
              ROW_NUMBER() OVER (
                PARTITION BY s.id
                ORDER BY COALESCE(pay.paid_at, pay.created_at) ASC
              ) AS payment_rank
       FROM public.student_payment_records pay
       JOIN public.student_dorm_reservations s ON s.id = pay.reservation_id
       JOIN public.boarding_house_app_users stu ON stu.id = pay.student_user_id
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE r.owner_user_id = $1::uuid
       ORDER BY pay.created_at DESC`,
      [ownerId]
    );

    // Compute monthly income totals (rent payments)
    // Also track advance and deposit portions from student first payments
    const monthlyIncomeMap: Record<string, { total: number; count: number; paid: number; tenants: string[] }> = {};

    // Helper: determine effective rent, deposit, advance for a student payment row
    function getPaymentBreakdown(row: {
      monthly_rent: string | null;
      room_monthly_rate: string | null;
      deposit_amount: string | null;
      advance_amount: string | null;
      amount: string;
      payment_rank: number | null;
    }): { rent: number; deposit: number; advance: number; isCombinedFirst: boolean } {
      // Use room_monthly_rate as fallback when reservation monthly_rent is 0
      const monthlyRent = Number(row.monthly_rent) || Number(row.room_monthly_rate) || 0;
      const storedDeposit = Number(row.deposit_amount) || 0;
      const storedAdvance = Number(row.advance_amount) || 0;
      const payAmount = Number(row.amount) || 0;

      // Detect combined first payment by amount pattern (>= 3× monthly rent),
      // NOT by payment_rank — earlier regular payments may have lower timestamps.
      const isMoveInPayment = monthlyRent > 0 && payAmount >= monthlyRent * 3 - 0.01;

      let deposit = storedDeposit;
      let advance = storedAdvance;

      // If deposit/advance are 0 on the reservation (sync hasn't run yet), infer from payment amount
      if (isMoveInPayment && storedDeposit === 0 && storedAdvance === 0) {
        const expectedTotal = monthlyRent * 3;
        if (Math.abs(payAmount - expectedTotal) < 5) {
          // First payment = rent + deposit + advance, each equal to monthly_rent
          deposit = monthlyRent;
          advance = monthlyRent;
        } else {
          // Payment includes extra beyond rent; split the excess equally
          const excess = payAmount - monthlyRent;
          deposit = Math.round(excess / 2);
          advance = excess - deposit;
        }
      }

      const totalInitial = monthlyRent + deposit + advance;
      const isCombinedFirst =
        isMoveInPayment &&
        totalInitial > 0 &&
        payAmount > monthlyRent &&
        Math.abs(payAmount - totalInitial) < 5;

      return { rent: monthlyRent, deposit, advance, isCombinedFirst };
    }

    for (const row of studentRows) {
      const { rent: monthlyRent, deposit: depositAmount, advance: advanceAmount, isCombinedFirst: isCombinedFirstPayment } = getPaymentBreakdown(row);
      const payAmount = Number(row.amount) || 0;

      // Only count rent portion in monthly total (not deposit/advance)
      const rentPortion = isCombinedFirstPayment ? monthlyRent : payAmount;

      const paidOn = row.paid_at ? new Date(row.paid_at).toISOString().slice(0, 10) : row.created_at.toISOString().slice(0, 10);
      const monthKey = `${paidOn.slice(0, 7)}`;
      if (!monthlyIncomeMap[monthKey]) {
        monthlyIncomeMap[monthKey] = { total: 0, count: 0, paid: 0, tenants: [] };
      }
      monthlyIncomeMap[monthKey].total += rentPortion;
      monthlyIncomeMap[monthKey].count += 1;
      if (row.status === "Paid") {
        monthlyIncomeMap[monthKey].paid += rentPortion;
      }
      if (!monthlyIncomeMap[monthKey].tenants.includes(row.payer_name || "Unknown")) {
        monthlyIncomeMap[monthKey].tenants.push(row.payer_name || "Unknown");
      }
    }

    // Advance payments (landlord_payments with entry_source='advance') + student first-payment advance portions
    const advanceMap: Record<string, { total: number; count: number; payer: string; property: string }> = {};
    for (const row of landlordRows) {
      if (row.entry_source === "advance") {
        const key = row.paid_on?.slice(0, 7) ?? row.created_at.toISOString().slice(0, 7);
        const payer = row.payer_name || "Unknown";
        const property = row.property_name || "Unknown";
        const compositeKey = `${key}|${payer}|${property}`;
        if (!advanceMap[compositeKey]) {
          advanceMap[compositeKey] = { total: 0, count: 0, payer, property };
        }
        advanceMap[compositeKey].total += Number(row.amount) || 0;
        advanceMap[compositeKey].count += 1;
      }
    }

    // Deposit payments (landlord_payments with entry_source='deposit') + student first-payment deposit portions
    const depositMap: Record<string, { total: number; count: number; payer: string; property: string }> = {};
    for (const row of landlordRows) {
      if (row.entry_source === "deposit") {
        const key = row.paid_on?.slice(0, 7) ?? row.created_at.toISOString().slice(0, 7);
        const payer = row.payer_name || "Unknown";
        const property = row.property_name || "Unknown";
        const compositeKey = `${key}|${payer}|${property}`;
        if (!depositMap[compositeKey]) {
          depositMap[compositeKey] = { total: 0, count: 0, payer, property };
        }
        depositMap[compositeKey].total += Number(row.amount) || 0;
        depositMap[compositeKey].count += 1;
      }
    }

    // Add student first-payment advance and deposit portions to the maps
    for (const row of studentRows) {
      const { deposit: depositAmount, advance: advanceAmount, isCombinedFirst: isCombinedFirstPayment } = getPaymentBreakdown(row);

      if (isCombinedFirstPayment) {
        const key = row.paid_at
          ? new Date(row.paid_at).toISOString().slice(0, 7)
          : row.created_at.toISOString().slice(0, 7);
        const payer = row.payer_name || "Unknown";
        const property = row.property_name ?? "Unknown";
        const compositeKey = `${key}|${payer}|${property}`;
        // Add advance portion
        if (advanceAmount > 0) {
          if (!advanceMap[compositeKey]) {
            advanceMap[compositeKey] = { total: 0, count: 0, payer, property };
          }
          advanceMap[compositeKey].total += advanceAmount;
          advanceMap[compositeKey].count += 1;
        }
        // Add deposit portion
        if (depositAmount > 0) {
          if (!depositMap[compositeKey]) {
            depositMap[compositeKey] = { total: 0, count: 0, payer, property };
          }
          depositMap[compositeKey].total += depositAmount;
          depositMap[compositeKey].count += 1;
        }
      }
    }

    // Monthly rent summary
    const monthlySummary: Array<{
      month: string;
      total: number;
      paid: number;
      count: number;
      tenants: string[];
      advanceTotal: number;
      depositTotal: number;
    }> = Object.entries(monthlyIncomeMap)
      .map(([month, data]) => {
        // Sum all advance/deposit entries for this month (multiple payers)
        const advanceTotal = Object.entries(advanceMap)
          .filter(([ck]) => ck.startsWith(month + "|"))
          .reduce((sum, [, v]) => sum + v.total, 0);
        const depositTotal = Object.entries(depositMap)
          .filter(([ck]) => ck.startsWith(month + "|"))
          .reduce((sum, [, v]) => sum + v.total, 0);
        return {
          month,
          total: data.total,
          paid: data.paid,
          count: data.count,
          tenants: data.tenants,
          advanceTotal,
          depositTotal,
        };
      })
      .sort((a, b) => (a.month < b.month ? -1 : 1));

    // Get full list of tenant payment records for the selected month
    const monthFilter = new URLSearchParams(new URL(req.url).search).get("month");
    const targetMonth = monthFilter ?? Object.keys(monthlyIncomeMap).sort().pop() ?? "";

    const tenantPayments: Array<{
      id: string;
      source: string;
      dormName: string;
      roomNo: string;
      payerName: string;
      amount: number;
      method: string;
      status: string;
      date: string;
      periodLabel?: string;
    }> = [];

    for (const row of studentRows) {
      if (targetMonth && row.paid_at) {
        const paidOn = new Date(row.paid_at).toISOString().slice(0, 7);
        if (paidOn !== targetMonth) continue;
      } else if (targetMonth && !row.paid_at) {
        const created = row.created_at.toISOString().slice(0, 7);
        if (created !== targetMonth) continue;
      }

      const { rent: monthlyRent, deposit: depositAmount, advance: advanceAmount, isCombinedFirst: isCombinedFirstPayment } = getPaymentBreakdown(row);
      const payAmount = Number(row.amount) || 0;

      // If this is the first payment for the reservation and the amount
      // includes deposit + advance + rent, split it into separate line items
      const paymentDate = row.paid_at
        ? new Date(row.paid_at).toISOString().slice(0, 10)
        : row.created_at.toISOString().slice(0, 10);

      if (isCombinedFirstPayment) {
        // Split into 3 line items: rent, deposit, advance
        tenantPayments.push({
          id: `${row.id}-rent`,
          source: "student",
          dormName: row.property_name ?? "Unknown",
          roomNo: row.room_no ?? "—",
          payerName: row.payer_name,
          amount: monthlyRent,
          method: row.method,
          status: mapStudentPayStatus(row.status),
          date: paymentDate,
          periodLabel: "Rent (1st month)",
        });
        tenantPayments.push({
          id: `${row.id}-deposit`,
          source: "student",
          dormName: row.property_name ?? "Unknown",
          roomNo: row.room_no ?? "—",
          payerName: row.payer_name,
          amount: depositAmount,
          method: row.method,
          status: mapStudentPayStatus(row.status),
          date: paymentDate,
          periodLabel: "Security Deposit",
        });
        tenantPayments.push({
          id: `${row.id}-advance`,
          source: "student",
          dormName: row.property_name ?? "Unknown",
          roomNo: row.room_no ?? "—",
          payerName: row.payer_name,
          amount: advanceAmount,
          method: row.method,
          status: mapStudentPayStatus(row.status),
          date: paymentDate,
          periodLabel: "Advance Payment",
        });
      } else {
        tenantPayments.push({
          id: row.id,
          source: "student",
          dormName: row.property_name ?? "Unknown",
          roomNo: row.room_no ?? "—",
          payerName: row.payer_name,
          amount: payAmount,
          method: row.method,
          status: mapStudentPayStatus(row.status),
          date: paymentDate,
          periodLabel: row.schedule_month_number
            ? `Month ${row.schedule_month_number}`
            : undefined,
        });
      }
    }

    for (const row of landlordRows) {
      if (row.entry_source === "advance" || row.entry_source === "deposit") {
        continue;
      }
      if (targetMonth && row.paid_on) {
        if (row.paid_on.slice(0, 7) !== targetMonth) continue;
      }
      tenantPayments.push({
        id: `lp-${row.id}`,
        source: "manual",
        dormName: row.property_name ?? "Unknown",
        roomNo: row.room_no ?? "—",
        payerName: row.payer_name,
        amount: Number(row.amount) || 0,
        method: row.method,
        status: row.status as "Paid" | "Pending" | "Overdue",
        date: row.paid_on?.slice(0, 10) ?? row.created_at.toISOString().slice(0, 10),
      });
    }

    const result = {
      monthlySummary,
      tenantPayments,
      advanceSummary: Object.entries(advanceMap)
        .filter(([ck]) => !targetMonth || ck.startsWith(targetMonth + "|"))
        .map(([ck, data]) => ({
          month: ck.slice(0, 7),
          total: data.total,
          count: data.count,
          payer: data.payer,
          property: data.property,
        }))
        .sort((a, b) => a.month.localeCompare(b.month) || a.payer.localeCompare(b.payer)),
      depositSummary: Object.entries(depositMap)
        .filter(([ck]) => !targetMonth || ck.startsWith(targetMonth + "|"))
        .map(([ck, data]) => ({
          month: ck.slice(0, 7),
          total: data.total,
          count: data.count,
          payer: data.payer,
          property: data.property,
        }))
        .sort((a, b) => a.month.localeCompare(b.month) || a.payer.localeCompare(b.payer)),
      targetMonth,
    };

    if (isPdf) {
      const pdfBytes = await buildIncomePdfReport(result);
      return new NextResponse(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="income-report-${targetMonth ?? "all"}.pdf"`,
        },
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load income reports";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
