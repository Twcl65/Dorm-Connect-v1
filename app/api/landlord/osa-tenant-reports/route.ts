import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { landlordLog } from "@/lib/landlord-db";
import { insertNotification } from "@/lib/notify-user";
import { requireLandlord } from "@/lib/require-owner";
import type { Pool } from "pg";

export const dynamic = "force-dynamic";

async function ensureOsaTenantReportsTable(pool: Pool) {
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
}

export async function GET() {
  const session = await requireLandlord();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const pool = await getPool();
    await ensureOsaTenantReportsTable(pool);
    const { rows } = await pool.query<{
      id: string;
      tenant_name: string;
      room_no: string | null;
      property_name: string | null;
      reason: string;
      details: string;
      status: string;
      created_at: Date;
    }>(
      `SELECT id, tenant_name, room_no, property_name, reason, details, status, created_at
       FROM public.landlord_osa_tenant_reports
       WHERE owner_user_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 100`,
      [session.sub]
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
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load reports";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireLandlord();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const body = (await req.json()) as {
      leaseId?: string;
      tenantName?: string;
      roomNo?: string;
      propertyName?: string;
      reason?: string;
      details?: string;
    };
    const tenantName = (body.tenantName ?? "").trim();
    const reason = (body.reason ?? "").trim();
    const details = (body.details ?? "").trim();
    if (!tenantName || !reason || !details) {
      return NextResponse.json(
        { error: "Tenant, reason, and details are required." },
        { status: 400 }
      );
    }
    const leaseId =
      body.leaseId && /^[0-9a-f-]{36}$/i.test(body.leaseId)
        ? body.leaseId
        : null;

    const pool = await getPool();
    await ensureOsaTenantReportsTable(pool);
    let studentUserId: string | null = null;
    if (leaseId) {
      const { rows } = await pool.query<{
        id: string;
        student_user_id: string | null;
      }>(
        `SELECT l.id, s.student_user_id
         FROM public.landlord_tenant_leases l
         LEFT JOIN public.student_dorm_reservations s
           ON s.id = l.student_reservation_id
         WHERE l.id = $1::uuid AND l.owner_user_id = $2::uuid`,
        [leaseId, session.sub]
      );
      if (!rows[0]) {
        return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
      }
      studentUserId = rows[0].student_user_id;
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.landlord_osa_tenant_reports
        (owner_user_id, lease_id, student_user_id, tenant_name, room_no, property_name, reason, details)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        session.sub,
        leaseId,
        studentUserId,
        tenantName,
        (body.roomNo ?? "").trim() || null,
        (body.propertyName ?? "").trim() || null,
        reason,
        details,
      ]
    );

    await landlordLog(
      pool,
      session.sub,
      `Reported tenant ${tenantName} to OSA: ${reason}`
    );

    try {
      const { rows: osaAdmins } = await pool.query<{ id: string }>(
        `SELECT id FROM public.boarding_house_app_users
         WHERE status = 'Active' AND role = 'OSA/SAS Admin'`
      );
      const landlordName = session.name?.trim() || "A landlord";
      for (const osa of osaAdmins) {
        await insertNotification(
          pool,
          osa.id,
          "Landlord tenant report",
          `${landlordName} reported tenant ${tenantName} (${reason}). Open Tenant Monitoring.`,
          "tenant-report"
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
