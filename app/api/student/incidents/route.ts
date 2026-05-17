import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";
import { filterAllowedStoredFileUrls } from "@/lib/upload-url";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;

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
      landlord_name: string | null;
    }>(
      `SELECT r.id, r.title, r.description, r.status, r.image_urls, r.created_at,
              lr.room_no, p.name AS property_name, u.full_name AS landlord_name
       FROM public.dorm_incident_reports r
       LEFT JOIN public.landlord_rooms lr ON lr.id = r.room_id
       LEFT JOIN public.landlord_properties p ON p.id = r.property_id
       JOIN public.boarding_house_app_users u ON u.id = r.owner_user_id
       WHERE r.reporter_user_id = $1::uuid
       ORDER BY r.created_at DESC`,
      [studentId]
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
        landlordName: x.landlord_name,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load reports";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;

  try {
    const body = (await req.json()) as {
      roomId?: string;
      title?: string;
      description?: string;
      imageUrls?: string[];
    };
    const roomId =
      body.roomId && /^[0-9a-f-]{36}$/i.test(body.roomId) ? body.roomId : null;
    const title = (body.title ?? "").trim();
    const description = (body.description ?? "").trim();
    const imageUrls = filterAllowedStoredFileUrls(body.imageUrls);

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required." },
        { status: 400 }
      );
    }

    const pool = await getPool();

    let ownerUserId: string | null = null;
    let propertyId: string | null = null;

    if (roomId) {
      const { rows: rr } = await pool.query<{
        owner_user_id: string;
        property_id: string;
      }>(
        `SELECT owner_user_id, property_id FROM public.landlord_rooms WHERE id = $1::uuid`,
        [roomId]
      );
      ownerUserId = rr[0]?.owner_user_id ?? null;
      propertyId = rr[0]?.property_id ?? null;
      if (!ownerUserId) {
        return NextResponse.json({ error: "Room not found." }, { status: 404 });
      }
    } else {
      return NextResponse.json(
        { error: "Select a room so the report goes to the correct landlord." },
        { status: 400 }
      );
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.dorm_incident_reports
        (reporter_user_id, owner_user_id, room_id, property_id, title, description, image_urls)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::jsonb)
       RETURNING id`,
      [
        studentId,
        ownerUserId,
        roomId,
        propertyId,
        title,
        description,
        JSON.stringify(imageUrls),
      ]
    );

    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to submit report";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
