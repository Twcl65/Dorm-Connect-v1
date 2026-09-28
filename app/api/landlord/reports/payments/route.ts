import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOwner } from "@/lib/require-owner";
import { buildDocxReport } from "../_docx";

export const dynamic = "force-dynamic";

function normalizeMethod(m: string): "GCash" | "Cash" | "Bank Transfer" {
  if (m === "GCash" || m === "Cash" || m === "Bank Transfer") return m;
  return "GCash";
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
  const { searchParams } = new URL(req.url);
  const reservationId = (searchParams.get("reservationId") ?? "").trim();
  const roomId = (searchParams.get("roomId") ?? "").trim();

  try {
    const pool = await getPool();

    let landlordPayQuery = `SELECT p.id, p.created_at, r.room_no, p.payer_name, p.amount::text, p.method, p.status,
              p.reference_no, p.proof_url, p.paid_on::text,
              pr.name AS property_name
       FROM public.landlord_payments p
       LEFT JOIN public.landlord_rooms r ON r.id = p.room_id
       LEFT JOIN public.landlord_properties pr ON pr.id = r.property_id
       WHERE p.owner_user_id = $1::uuid`;
    let landlordPayParams: unknown[] = [ownerId];

    let studentPayQuery = `SELECT pay.id, pay.created_at, r.room_no, stu.full_name AS payer_name,
              pay.amount::text, pay.method, pay.status, pay.receipt_url, pay.paid_at,
              p.name AS property_name,
              pay.schedule_month_number,
              s.lease_start::text AS lease_start,
              pay.reservation_id,
              s.id AS reservation_id
       FROM public.student_payment_records pay
       JOIN public.student_dorm_reservations s ON s.id = pay.reservation_id
       JOIN public.boarding_house_app_users stu ON stu.id = pay.student_user_id
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE r.owner_user_id = $1::uuid`;
    let studentPayParams: unknown[] = [ownerId];

    if (reservationId) {
      studentPayQuery = `${studentPayQuery} AND pay.reservation_id = $2::uuid`;
      studentPayParams.push(reservationId);
    } else if (roomId) {
      landlordPayQuery = `${landlordPayQuery} AND p.room_id = $2::uuid`;
      landlordPayParams.push(roomId);
      studentPayQuery = `${studentPayQuery} AND s.room_id = $2::uuid`;
      studentPayParams.push(roomId);
    }

    const [landlordPay, studentPay] = await Promise.all([
      pool.query(landlordPayQuery, landlordPayParams),
      pool.query(studentPayQuery, studentPayParams),
    ]);

    const combined = [
      ...landlordPay.rows.map((x) => {
        const paidOn = x.paid_on?.slice(0, 10) ?? "";
        const monthLabel = (() => {
          const leaseStart = (x as Record<string, unknown>).lease_start as string | undefined;
          const d = paidOn ? new Date(paidOn) : null;
          if (!d || isNaN(d.getTime())) return "";
          const start = leaseStart ? new Date(leaseStart) : null;
          if (start && !isNaN(start.getTime())) {
            const m = Math.max(1, Math.round((d.getTime() - start.getTime()) / (30.44 * 24 * 60 * 60 * 1000)) + 1);
            const base = new Date(start);
            base.setHours(12, 0, 0, 0);
            base.setMonth(base.getMonth() + m - 1);
            return `Month ${m} (${base.toLocaleDateString("en-US", { month: "long" })})`;
          }
          return `Month 1 (${d.toLocaleDateString("en-US", { month: "long" })})`;
        })();
        return {
          source: "manual" as const,
          monthLabel,
          roomNo: x.room_no ?? "",
          payerName: x.payer_name,
          amount: Number(x.amount) || 0,
          paidOn,
          createdAt: x.created_at.toISOString(),
          paymentId: x.id,
          dormName: x.property_name ?? "",
          method: normalizeMethod(x.method),
          status: x.status,
          referenceNo: x.reference_no ?? "",
          proofUrl: x.proof_url ?? "",
        };
      }),
      ...studentPay.rows.map((x) => {
        const paidOn = x.paid_at ? new Date(x.paid_at).toISOString().slice(0, 10) : "";
        const monthLabel =
          x.schedule_month_number && x.lease_start
            ? (() => {
                const start = new Date(x.lease_start);
                if (isNaN(start.getTime())) return "";
                start.setHours(12, 0, 0, 0);
                start.setMonth(start.getMonth() + x.schedule_month_number - 1);
                return `Month ${x.schedule_month_number} (${start.toLocaleDateString("en-US", { month: "long" })})`;
              })()
            : paidOn
              ? (() => {
                  const d = new Date(paidOn);
                  return `Month 1 (${d.toLocaleDateString("en-US", { month: "long" })})`;
                })()
              : "";
        return {
          source: "student" as const,
          monthLabel,
          roomNo: x.room_no ?? "",
          payerName: x.payer_name,
          amount: Number(x.amount) || 0,
          paidOn,
          createdAt: x.created_at.toISOString(),
          paymentId: x.id,
          dormName: x.property_name,
          method: normalizeMethod(x.method),
          status: mapStudentPayStatus(x.status),
          referenceNo: "",
          proofUrl: x.receipt_url ?? "",
        };
      }),
    ];

    const seen = new Set<string>();
    const data = combined.filter((row) => {
      const key = `${row.source}|${row.payerName}|${row.amount}|${row.paidOn}|${row.monthLabel}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const buf = await buildDocxReport({
      title: "Payments Report",
      subtitle: reservationId
        ? "Filtered by selected tenant lease."
        : "Student app payments and manual payment entries.",
      columns: [
        { key: "createdAt", label: "Recorded At" },
        { key: "source", label: "Source" },
        { key: "monthLabel", label: "Month" },
        { key: "roomNo", label: "Room" },
        { key: "payerName", label: "Payer" },
        { key: "amount", label: "Amount" },
        { key: "method", label: "Method" },
        { key: "status", label: "Status" },
        { key: "paidOn", label: "Paid On" },
        { key: "proofUrl", label: "Proof URL" },
      ],
      rows: data,
    });

    const filename = reservationId
      ? `payments-report-${reservationId}.docx`
      : "payments-report.docx";

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to export payments report";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

