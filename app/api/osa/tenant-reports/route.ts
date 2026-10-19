import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";
import { insertNotification } from "@/lib/notify-user";

export const dynamic = "force-dynamic";

async function ensureOsaTenantReportsTable() {
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.landlord_osa_tenant_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
      lease_id UUID REFERENCES public.landlord_tenant_leases (id) ON DELETE SET NULL,
      student_user_id UUID REFERENCES public.boarding_house_app_users (id) ON DELETE SET NULL,
      tenant_name TEXT NOT NULL,
      room_no TEXT,
      property_name TEXT,
      reason TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    ALTER TABLE public.landlord_osa_tenant_reports
      ADD COLUMN IF NOT EXISTS osa_reply TEXT,
      ADD COLUMN IF NOT EXISTS osa_replied_at TIMESTAMPTZ;
  `);
  return pool;
}

export async function GET() {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const pool = await ensureOsaTenantReportsTable();
    const { rows } = await pool.query<{
      id: string;
      tenant_name: string;
      room_no: string | null;
      property_name: string | null;
      reason: string;
      details: string;
      status: string;
      created_at: Date;
      landlord_name: string;
      osa_reply: string | null;
      osa_replied_at: Date | null;
    }>(
      `SELECT r.id, r.tenant_name, r.room_no, r.property_name, r.reason, r.details,
              r.status, r.created_at, r.osa_reply, r.osa_replied_at, u.full_name AS landlord_name
       FROM public.landlord_osa_tenant_reports r
       JOIN public.boarding_house_app_users u ON u.id = r.owner_user_id
       ORDER BY r.created_at DESC
       LIMIT 200`
    );
    return NextResponse.json({
      reports: rows.map((r) => ({
        id: r.id,
        tenantName: r.tenant_name,
        roomNo: r.room_no,
        propertyName: r.property_name,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: new Date(r.created_at).toISOString(),
        landlordName: r.landlord_name,
        osaReply: r.osa_reply,
        osaRepliedAt: r.osa_replied_at ? new Date(r.osa_replied_at).toISOString() : null,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load reports";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { id?: string; status?: string; osaReply?: string };
    const id = body.id ?? "";
    const status = body.status;
    const osaReply = body.osaReply;
    
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }
    if (status && status !== "Open" && status !== "In Review" && status !== "Resolved") {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    const pool = await ensureOsaTenantReportsTable();
    
    let query = `UPDATE public.landlord_osa_tenant_reports SET updated_at = now()`;
    const params: any[] = [];
    let paramIdx = 1;

    if (status) {
      query += `, status = $${paramIdx++}`;
      params.push(status);
    }
    if (osaReply !== undefined) {
      query += `, osa_reply = $${paramIdx++}, osa_replied_at = now()`;
      params.push(osaReply);
    }

    query += ` WHERE id = $${paramIdx}::uuid RETURNING owner_user_id, tenant_name`;
    params.push(id);

    const { rows } = await pool.query<{ owner_user_id: string; tenant_name: string }>(query, params);
    if (!rows[0]) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (osaReply) {
      try {
        await insertNotification(
          pool,
          rows[0].owner_user_id,
          "OSA Replied to Report",
          `OSA has replied to your report regarding tenant ${rows[0].tenant_name}.`,
          "tenant-report"
        );
      } catch {
        /* non-fatal */
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
