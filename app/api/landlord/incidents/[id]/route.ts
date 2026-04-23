import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  context: { params: { id: string } }
) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as { status?: string };
    const status =
      body.status === "Open" ||
      body.status === "Acknowledged" ||
      body.status === "Resolved"
        ? body.status
        : null;
    if (!status) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const pool = await getPool();
    const { rows } = await pool.query<{ id: string }>(
      `UPDATE public.dorm_incident_reports
       SET status = $1, updated_at = now()
       WHERE id = $2::uuid AND owner_user_id = $3::uuid
       RETURNING id`,
      [status, id, ownerId]
    );
    if (!rows[0]) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
