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

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();

    const { rows: landlordPay } = await pool.query<{
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
      property_name: string | null;
    }>(
      `SELECT p.id, p.created_at, r.room_no, p.payer_name, p.amount::text, p.method, p.status,
              p.reference_no, p.proof_url, p.paid_on::text,
              pr.name AS property_name
       FROM public.landlord_payments p
       LEFT JOIN public.landlord_rooms r ON r.id = p.room_id
       LEFT JOIN public.landlord_properties pr ON pr.id = r.property_id
       WHERE p.owner_user_id = $1::uuid`,
      [ownerId]
    );

    const { rows: studentPay } = await pool.query<{
      id: string;
      created_at: Date;
      room_no: string;
      payer_name: string;
      amount: string;
      method: string;
      status: string;
      receipt_url: string | null;
      paid_at: Date | null;
      property_name: string;
      schedule_month_number: number | null;
      lease_start: string | null;
    }>(
      `SELECT pay.id, pay.created_at, r.room_no, stu.full_name AS payer_name,
              pay.amount::text, pay.method, pay.status, pay.receipt_url, pay.paid_at,
              p.name AS property_name,
              pay.schedule_month_number,
              s.lease_start::text AS lease_start
       FROM public.student_payment_records pay
       JOIN public.student_dorm_reservations s ON s.id = pay.reservation_id
       JOIN public.boarding_house_app_users stu ON stu.id = pay.student_user_id
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE r.owner_user_id = $1::uuid`,
      [ownerId]
    );

    const data = [
      ...landlordPay.map((x) => {
        const paidOn = x.paid_on?.slice(0, 10) ?? "";
        const monthLabel = paidOn
          ? (() => {
              const d = new Date(paidOn);
              return `Month 1 (${d.toLocaleDateString("en-US", { month: "long" })})`;
            })()
          : "";
        return {
          paymentId: x.id,
          source: "manual",
          monthLabel,
          dormName: x.property_name ?? "",
          roomNo: x.room_no ?? "",
          payerName: x.payer_name,
          amount: Number(x.amount) || 0,
          method: normalizeMethod(x.method),
          status: x.status,
          referenceNo: x.reference_no ?? "",
          proofUrl: x.proof_url ?? "",
          paidOn,
          createdAt: x.created_at.toISOString(),
        };
      }),
      ...studentPay.map((x) => {
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
          paymentId: x.id,
          source: "student",
          monthLabel,
          dormName: x.property_name,
          roomNo: x.room_no ?? "",
          payerName: x.payer_name,
          amount: Number(x.amount) || 0,
          method: normalizeMethod(x.method),
          status: mapStudentPayStatus(x.status),
          referenceNo: "",
          proofUrl: x.receipt_url ?? "",
          paidOn,
          createdAt: x.created_at.toISOString(),
        };
      }),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const buf = await buildDocxReport({
      title: "Payments Report",
      subtitle: "Student app payments and manual payment entries.",
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

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="payments-report.docx"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to export payments report";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

