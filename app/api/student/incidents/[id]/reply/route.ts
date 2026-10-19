import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function POST(req: Request, context: Ctx) {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const studentId = session.sub;
  const incidentId = context.params.id;

  try {
    const { tenantReply } = (await req.json()) as { tenantReply?: string };
    if (!tenantReply || !tenantReply.trim()) {
      return NextResponse.json(
        { error: "Reply text is required." },
        { status: 400 }
      );
    }

    const pool = await getPool();

    // Verify the incident belongs to this student and actually has a landlord reply
    const checkRes = await pool.query(
      `SELECT id, landlord_reply FROM public.dorm_incident_reports
       WHERE id = $1::uuid AND reporter_user_id = $2::uuid`,
      [incidentId, studentId]
    );

    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: "Incident not found." }, { status: 404 });
    }

    if (!checkRes.rows[0].landlord_reply) {
      return NextResponse.json(
        { error: "Cannot reply before the landlord has responded." },
        { status: 400 }
      );
    }

    await pool.query(
      `UPDATE public.dorm_incident_reports
       SET tenant_reply = $1, tenant_replied_at = NOW()
       WHERE id = $2::uuid AND reporter_user_id = $3::uuid`,
      [tenantReply.trim(), incidentId, studentId]
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to post reply";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
