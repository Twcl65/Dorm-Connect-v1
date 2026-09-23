import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOwner } from "@/lib/require-owner";
import { insertNotification } from "@/lib/notify-user";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const body = (await req.json()) as {
      leaseId?: string;
      studentUserId?: string;
      propertyName?: string;
      title?: string;
      description?: string;
      tenantName?: string;
      roomNo?: string;
    };
    
    const leaseId = body.leaseId && /^[0-9a-f-]{36}$/i.test(body.leaseId) ? body.leaseId : null;
    const studentUserId = body.studentUserId || null;
    const propertyName = body.propertyName || null;
    const title = (body.title ?? "").trim();
    const description = (body.description ?? "").trim();
    const tenantName = (body.tenantName ?? "").trim();
    const roomNo = (body.roomNo ?? "").trim();

    if (!title || !description || !tenantName) {
      return NextResponse.json(
        { error: "Title, description, and tenant name are required." },
        { status: 400 }
      );
    }

    const pool = await getPool();

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.landlord_osa_tenant_reports
        (owner_user_id, lease_id, student_user_id, tenant_name, room_no, property_name, reason, details)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        ownerId,
        leaseId,
        studentUserId,
        tenantName,
        roomNo || null,
        propertyName || null,
        title,
        description
      ]
    );

    try {
      const { rows: admins } = await pool.query<{ id: string }>(
        `SELECT id FROM public.boarding_house_app_users WHERE role = 'osa_admin'`
      );
      for (const admin of admins) {
        await insertNotification(
          pool,
          admin.id,
          "New Tenant Report",
          `A landlord submitted a report against tenant ${tenantName}.`,
          "report"
        );
      }
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to submit report";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();
    const { rows } = await pool.query(
      `SELECT id, tenant_name, room_no, property_name, reason, details, status, created_at, osa_reply, osa_replied_at
       FROM public.landlord_osa_tenant_reports
       WHERE owner_user_id = $1::uuid
       ORDER BY created_at DESC`,
      [ownerId]
    );

    const formattedRows = rows.map(r => ({
      id: r.id,
      tenantName: r.tenant_name,
      roomNo: r.room_no,
      propertyName: r.property_name,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
      osaReply: r.osa_reply,
      osaRepliedAt: r.osa_replied_at ? new Date(r.osa_replied_at).toISOString() : null
    }));

    return NextResponse.json({ reports: formattedRows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load reports";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
