import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOwner } from "@/lib/require-owner";
import { buildDocxReport } from "../_docx";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();

    const { rows: manual } = await pool.query<{
      id: string;
      created_at: Date;
      room_no: string | null;
      guest_name: string;
      email: string | null;
      contact: string | null;
      lease_start: string;
      lease_end: string;
      status: string;
      payment_method: string | null;
      amount_paid: string;
      reference_no: string | null;
      proof_url: string | null;
      property_name: string;
    }>(
      `SELECT r.id, r.created_at, rm.room_no, r.guest_name, r.email, r.contact,
              r.lease_start::text, r.lease_end::text, r.status,
              r.payment_method, r.amount_paid::text, r.reference_no, r.proof_url,
              p.name AS property_name
       FROM public.landlord_reservations r
       JOIN public.landlord_properties p ON p.id = r.property_id
       LEFT JOIN public.landlord_rooms rm ON rm.id = r.room_id
       WHERE r.owner_user_id = $1::uuid`,
      [ownerId]
    );

    const { rows: student } = await pool.query<{
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
      `SELECT s.id, s.created_at, r.room_no, stu.full_name AS guest_name,
              stu.email AS student_email,
              s.lease_start::text, s.lease_end::text, s.status, s.rent_payment_status,
              p.name AS property_name
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       JOIN public.boarding_house_app_users stu ON stu.id = s.student_user_id
       WHERE r.owner_user_id = $1::uuid`,
      [ownerId]
    );

    const data = [
      ...manual.map((r) => ({
        reservationId: r.id,
        source: "manual",
        dormName: r.property_name,
        roomNo: r.room_no ?? "",
        guestName: r.guest_name,
        email: r.email ?? "",
        contact: r.contact ?? "",
        leaseStart: r.lease_start.slice(0, 10),
        leaseEnd: r.lease_end.slice(0, 10),
        reservationStatus: r.status,
        rentPaymentStatus: "",
        paymentMethod: r.payment_method ?? "",
        amountPaid: Number(r.amount_paid) || 0,
        referenceNo: r.reference_no ?? "",
        proofUrl: r.proof_url ?? "",
        createdAt: r.created_at.toISOString(),
      })),
      ...student.map((r) => ({
        reservationId: r.id,
        source: "student",
        dormName: r.property_name,
        roomNo: r.room_no ?? "",
        guestName: r.guest_name,
        email: r.student_email,
        contact: "",
        leaseStart: r.lease_start.slice(0, 10),
        leaseEnd: r.lease_end.slice(0, 10),
        reservationStatus: r.status,
        rentPaymentStatus: r.rent_payment_status,
        paymentMethod: "",
        amountPaid: 0,
        referenceNo: "",
        proofUrl: "",
        createdAt: r.created_at.toISOString(),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const buf = await buildDocxReport({
      title: "Reservations Report",
      subtitle: "Manual and student reservations recorded for your dorm.",
      columns: [
        { key: "createdAt", label: "Created At" },
        { key: "source", label: "Source" },
        { key: "dormName", label: "Dorm" },
        { key: "roomNo", label: "Room" },
        { key: "guestName", label: "Guest / Student" },
        { key: "email", label: "Email" },
        { key: "contact", label: "Contact" },
        { key: "leaseStart", label: "Start" },
        { key: "leaseEnd", label: "End" },
        { key: "reservationStatus", label: "Status" },
        { key: "rentPaymentStatus", label: "Rent Status" },
      ],
      rows: data,
    });

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="reservations-report.docx"`,
      },
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to export reservations report";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

