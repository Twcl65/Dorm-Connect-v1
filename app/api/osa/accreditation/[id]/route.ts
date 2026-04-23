import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, context: Ctx) {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
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
      owner_name: string;
      owner_email: string;
    }>(
      `SELECT a.id, a.dorm_name, a.address, a.status, a.documents_count, a.submitted_at, a.form_data,
              u.full_name AS owner_name, u.email AS owner_email
       FROM public.landlord_accreditation_requests a
       JOIN public.boarding_house_app_users u ON u.id = a.owner_user_id
       WHERE a.id = $1::uuid`,
      [id]
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
      ownerName: r.owner_name,
      ownerEmail: r.owner_email,
      formData: r.form_data,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Ctx) {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      status?: string;
      remarks?: string;
    };
    const status =
      body.status === "Submitted" ||
      body.status === "In Review" ||
      body.status === "Approved" ||
      body.status === "Rejected" ||
      body.status === "Needs Documents"
        ? body.status
        : null;
    if (!status) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const remarks = (body.remarks ?? "").trim();
    const pool = await getPool();

    if (remarks) {
      await pool.query(
        `UPDATE public.landlord_accreditation_requests
         SET status = $1, updated_at = now(),
             form_data = COALESCE(form_data, '{}'::jsonb) || $2::jsonb
         WHERE id = $3::uuid`,
        [status, JSON.stringify({ osa_remarks: remarks }), id]
      );
    } else {
      await pool.query(
        `UPDATE public.landlord_accreditation_requests
         SET status = $1, updated_at = now()
         WHERE id = $2::uuid`,
        [status, id]
      );
    }

    if (status === "Approved") {
      await pool.query(
        `UPDATE public.landlord_properties p
         SET name = trim(a.dorm_name),
             address = CASE
               WHEN trim(COALESCE(a.address, '')) = '' THEN p.address
               ELSE trim(a.address)
             END,
             updated_at = now()
         FROM public.landlord_accreditation_requests a
         WHERE a.id = $1::uuid
           AND a.property_id IS NOT NULL
           AND p.id = a.property_id
           AND trim(COALESCE(a.dorm_name, '')) <> ''`,
        [id]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
