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
    const { rows } = await pool.query<{
      id: string;
      tenant_name: string;
      email: string | null;
      phone: string | null;
      room_no: string;
      property_name: string;
      remarks: string | null;
      student_user_id: string | null;
      student_seq_id: number | null;
      student_full_name: string | null;
      student_email: string | null;
      student_status: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT l.id, l.tenant_name, l.email, l.phone, r.room_no,
              p.name AS property_name,
              l.remarks,
              u.id AS student_user_id,
              u.seq_id AS student_seq_id,
              u.full_name AS student_full_name,
              u.email AS student_email,
              u.status AS student_status,
              l.created_at, l.updated_at
       FROM public.landlord_tenant_leases l
       JOIN public.landlord_rooms r ON r.id = l.room_id
       JOIN public.landlord_properties p ON p.id = l.property_id
       LEFT JOIN public.student_dorm_reservations s ON s.id = l.student_reservation_id
       LEFT JOIN public.boarding_house_app_users u ON u.id = s.student_user_id
       WHERE l.owner_user_id = $1::uuid
       ORDER BY p.name, r.room_no, l.tenant_name`,
      [ownerId]
    );

    const data = rows.map((r) => ({
      tenantRecordId: r.id,
      tenantType: r.student_user_id ? "Student" : "Manual",
      studentUserId: r.student_user_id ?? "",
      studentIdNumber: r.student_seq_id ?? "",
      studentName: (r.student_full_name ?? "").trim() || r.tenant_name,
      studentEmail: (r.student_email ?? "").trim() || r.email || "",
      studentStatus: r.student_status ?? "",
      phone: r.phone ?? "",
      dormName: r.property_name,
      roomNo: r.room_no,
      notes: r.remarks ?? "",
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));

    const buf = await buildDocxReport({
      title: "Tenants Information Report",
      subtitle: "Student/tenant profile information (no lease/payment fields).",
      columns: [
        { key: "tenantType", label: "Type" },
        { key: "studentIdNumber", label: "Student ID No." },
        { key: "studentName", label: "Name" },
        { key: "studentEmail", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "studentStatus", label: "Status" },
        { key: "dormName", label: "Dorm" },
        { key: "roomNo", label: "Room" },
      ],
      rows: data,
    });

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="tenants-report.docx"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to export tenants report";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

