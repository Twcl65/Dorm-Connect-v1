import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
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
    const { rows } = await pool.query<{
      id: string;
      title: string;
      description: string;
      status: string;
      image_urls: unknown;
      created_at: Date;
      room_no: string | null;
      property_name: string | null;
      reporter_name: string;
    }>(
      `SELECT r.id, r.title, r.description, r.status, r.image_urls, r.created_at,
              lr.room_no, p.name AS property_name, rep.full_name AS reporter_name
       FROM public.dorm_incident_reports r
       LEFT JOIN public.landlord_rooms lr ON lr.id = r.room_id
       LEFT JOIN public.landlord_properties p ON p.id = r.property_id
       JOIN public.boarding_house_app_users rep ON rep.id = r.reporter_user_id
       WHERE r.owner_user_id = $1::uuid
       ORDER BY r.created_at DESC`,
      [ownerId]
    );
    return NextResponse.json({
      reports: rows.map((x) => ({
        id: x.id,
        title: x.title,
        description: x.description,
        status: x.status,
        imageUrls: Array.isArray(x.image_urls)
          ? (x.image_urls as string[])
          : [],
        createdAt: new Date(x.created_at).toISOString(),
        roomNo: x.room_no,
        propertyName: x.property_name,
        reporterName: x.reporter_name,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load reports";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
