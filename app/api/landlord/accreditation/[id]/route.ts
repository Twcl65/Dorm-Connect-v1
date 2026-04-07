import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, context: Ctx) {
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
    const pool = await getPool();
    const { rows } = await pool.query<{
      id: string;
      dorm_name: string;
      address: string;
      status: string;
      documents_count: number;
      submitted_at: Date;
      form_data: unknown;
    }>(
      `SELECT id, dorm_name, address, status, documents_count, submitted_at, form_data
       FROM public.landlord_accreditation_requests
       WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
      [id, ownerId]
    );
    const r = rows[0];
    if (!r) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({
      id: r.id,
      dormName: r.dorm_name,
      address: r.address,
      status: r.status,
      documentsCount: r.documents_count,
      submittedAt: new Date(r.submitted_at).toISOString().slice(0, 10),
      formData: r.form_data,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
