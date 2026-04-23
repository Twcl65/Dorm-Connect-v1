import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { landlordLog } from "@/lib/landlord-db";
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
    const { rows: properties } = await pool.query<{
      id: string;
      name: string;
    }>(
      `SELECT id, name FROM public.landlord_properties
       WHERE owner_user_id = $1::uuid
       ORDER BY name`,
      [ownerId]
    );

    const { rows } = await pool.query<{
      id: string;
      title: string;
      body: string;
      created_at: Date;
      audience: string;
      property_name: string;
      target_name: string | null;
    }>(
      `SELECT a.id, a.title, a.body, a.created_at, a.audience,
              p.name AS property_name,
              tgt.full_name AS target_name
       FROM public.landlord_tenant_announcements a
       JOIN public.landlord_properties p ON p.id = a.property_id
       LEFT JOIN public.boarding_house_app_users tgt ON tgt.id = a.target_student_user_id
       WHERE a.owner_user_id = $1::uuid
       ORDER BY a.created_at DESC`,
      [ownerId]
    );

    const announcements = rows.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.body,
      date: new Date(r.created_at).toISOString().slice(0, 10),
      audience: r.audience as "all_booked" | "single_student",
      propertyName: r.property_name,
      targetStudentName: r.target_name,
    }));

    return NextResponse.json({ properties, announcements });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to load tenant announcements";
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
      propertyId?: string;
      title?: string;
      body?: string;
      audience?: string;
      targetStudentUserId?: string | null;
    };
    const propertyId = (body.propertyId ?? "").trim();
    const title = (body.title ?? "").trim();
    const text = (body.body ?? "").trim();
    const audience =
      body.audience === "single_student" ? "single_student" : "all_booked";
    const targetStudentUserId =
      audience === "single_student"
        ? (body.targetStudentUserId ?? "").trim()
        : null;

    if (!propertyId || !title || !text) {
      return NextResponse.json(
        { error: "propertyId, title, and body are required." },
        { status: 400 }
      );
    }
    if (audience === "single_student" && !targetStudentUserId) {
      return NextResponse.json(
        { error: "Select a student for a targeted message." },
        { status: 400 }
      );
    }

    const pool = await getPool();
    const { rows: prop } = await pool.query<{ id: string }>(
      `SELECT id FROM public.landlord_properties
       WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
      [propertyId, ownerId]
    );
    if (!prop[0]) {
      return NextResponse.json(
        { error: "Property not found or not yours." },
        { status: 404 }
      );
    }

    if (audience === "single_student" && targetStudentUserId) {
      const { rows: ok } = await pool.query<{ ok: boolean }>(
        `SELECT true AS ok
         FROM public.student_dorm_reservations s
         JOIN public.landlord_rooms r ON r.id = s.room_id
         WHERE s.student_user_id = $1::uuid
           AND r.property_id = $2::uuid
           AND r.owner_user_id = $3::uuid
           AND s.status IN ('Pending', 'Confirmed')
         LIMIT 1`,
        [targetStudentUserId, propertyId, ownerId]
      );
      if (!ok[0]) {
        return NextResponse.json(
          {
            error:
              "That student does not have an active reservation at this dorm.",
          },
          { status: 400 }
        );
      }
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.landlord_tenant_announcements
        (property_id, owner_user_id, title, body, audience, target_student_user_id)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)
       RETURNING id`,
      [
        propertyId,
        ownerId,
        title,
        text,
        audience,
        audience === "single_student" ? targetStudentUserId : null,
      ]
    );

    await landlordLog(
      pool,
      ownerId,
      `Posted tenant announcement: ${title} (${audience})`
    );
    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Failed to post tenant announcement";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
