import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      property_id: string;
      dorm_name: string;
      owner_name: string;
      operational_status: string;
      compliance_status: string;
      total_rooms: string;
      occupied_rooms: string;
      tenant_students: string;
      students: any;
    }>(
      `SELECT p.id AS property_id, p.name AS dorm_name, u.full_name AS owner_name,
              p.operational_status, p.compliance_status,
              (SELECT COUNT(*)::text FROM public.landlord_rooms r WHERE r.property_id = p.id) AS total_rooms,
              (SELECT COUNT(*)::text FROM public.landlord_rooms r
               WHERE r.property_id = p.id AND r.status = 'Occupied') AS occupied_rooms,
              (SELECT COUNT(DISTINCT s.student_user_id)::text
               FROM public.student_dorm_reservations s
               JOIN public.landlord_rooms r ON r.id = s.room_id
               WHERE r.property_id = p.id AND s.status = 'Confirmed') AS tenant_students,
              (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                  'studentId', u2.id,
                  'name', u2.full_name,
                  'email', u2.email,
                  'schoolId', u2.student_id,
                  'roomNo', r2.room_no,
                  'occupancy', CASE WHEN s2.status = 'Confirmed' THEN 'Active' ELSE s2.status END
                ) ORDER BY u2.full_name), '[]'::jsonb)
               FROM public.student_dorm_reservations s2
               JOIN public.boarding_house_app_users u2 ON u2.id = s2.student_user_id
               JOIN public.landlord_rooms r2 ON r2.id = s2.room_id
               WHERE r2.property_id = p.id AND s2.status = 'Confirmed') AS students
       FROM public.landlord_properties p
       JOIN public.boarding_house_app_users u ON u.id = p.owner_user_id
       WHERE EXISTS (
         SELECT 1 FROM public.landlord_accreditation_requests a
         WHERE a.property_id = p.id AND a.status = 'Approved'
       )
       ORDER BY p.name`
    );

    const dorms = rows.map((r) => {
      const op = r.operational_status;
      const statusLabel =
        op === "Not Operating"
          ? "Not Operating"
          : op === "Under Inspection"
            ? "Under Inspection"
            : "Operating";

      // students may come back as JSON (parsed) or as a string depending on pg config
      let studentsList: any[] = [];
      try {
        if (Array.isArray(r.students)) studentsList = r.students;
        else if (typeof r.students === "string") studentsList = JSON.parse(r.students || "[]");
      } catch (e) {
        studentsList = [];
      }

      return {
        propertyId: r.property_id,
        dormName: r.dorm_name,
        ownerName: r.owner_name,
        status: statusLabel,
        students: Number(r.tenant_students ?? 0),
        studentsList,
        compliance: r.compliance_status as "Compliant" | "Warning" | "Non-Compliant",
        totalRooms: Number(r.total_rooms ?? 0),
        occupiedRooms: Number(r.occupied_rooms ?? 0),
      };
    });

    const total = dorms.length;
    const operating = dorms.filter((d) => d.status === "Operating").length;
    const notOperating = dorms.filter((d) => d.status === "Not Operating").length;
    const underInspection = dorms.filter((d) => d.status === "Under Inspection")
      .length;

    return NextResponse.json({
      summary: { total, operating, notOperating, underInspection },
      dorms,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load monitoring";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
