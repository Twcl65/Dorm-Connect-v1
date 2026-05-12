import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";
import { insertNotification } from "@/lib/notify-user";

export const dynamic = "force-dynamic";

const ACC_STATUSES = new Set([
  "Pending",
  "Scheduled for Inspection",
  "Recommended for Approval",
  "Hold",
  "Rejected",
  "Approved",
  "Expired",
]);

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
      owner_user_id: string;
      inspection_scheduled_for: string | null;
      accreditation_expires_at: Date | null;
    }>(
      `SELECT a.id, a.dorm_name, a.address, a.status, a.documents_count, a.submitted_at, a.form_data,
              a.owner_user_id, a.inspection_scheduled_for::text, a.accreditation_expires_at,
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
      ownerUserId: r.owner_user_id,
      formData: r.form_data,
      inspectionScheduledFor: r.inspection_scheduled_for,
      accreditationExpiresAt: r.accreditation_expires_at
        ? new Date(r.accreditation_expires_at).toISOString().slice(0, 10)
        : null,
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
      inspectionScheduledFor?: string | null;
    };
    const status = body.status && ACC_STATUSES.has(body.status) ? body.status : null;
    if (!status) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const remarks = (body.remarks ?? "").trim();
    const pool = await getPool();

    const { rows: before } = await pool.query<{
      owner_user_id: string;
      dorm_name: string;
      status: string;
    }>(
      `SELECT owner_user_id, dorm_name, status FROM public.landlord_accreditation_requests WHERE id = $1::uuid`,
      [id]
    );
    const prev = before[0];
    if (!prev) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const inspDate =
      body.inspectionScheduledFor !== undefined
        ? body.inspectionScheduledFor?.trim() || null
        : undefined;

    const mergeJson =
      remarks.length > 0
        ? JSON.stringify({ osa_remarks: remarks })
        : null;

    if (mergeJson && inspDate !== undefined) {
      await pool.query(
        `UPDATE public.landlord_accreditation_requests
         SET status = $1,
             inspection_scheduled_for = $2::date,
             updated_at = now(),
             form_data = COALESCE(form_data, '{}'::jsonb) || $3::jsonb
         WHERE id = $4::uuid`,
        [status, inspDate, mergeJson, id]
      );
    } else if (mergeJson) {
      await pool.query(
        `UPDATE public.landlord_accreditation_requests
         SET status = $1, updated_at = now(),
             form_data = COALESCE(form_data, '{}'::jsonb) || $2::jsonb
         WHERE id = $3::uuid`,
        [status, mergeJson, id]
      );
    } else if (inspDate !== undefined) {
      await pool.query(
        `UPDATE public.landlord_accreditation_requests
         SET status = $1,
             inspection_scheduled_for = $2::date,
             updated_at = now()
         WHERE id = $3::uuid`,
        [status, inspDate, id]
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
        `UPDATE public.landlord_accreditation_requests
         SET accreditation_expires_at = COALESCE(
               accreditation_expires_at,
               now() + interval '1 year'
             ),
             updated_at = now()
         WHERE id = $1::uuid`,
        [id]
      );
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

    if (status === "Scheduled for Inspection" && inspDate) {
      await pool.query(
        `INSERT INTO public.os_accredit_inspections
          (accreditation_request_id, scheduled_for)
         VALUES ($1::uuid, $2::date)`,
        [id, inspDate]
      );
      await insertNotification(
        pool,
        prev.owner_user_id,
        "Inspection scheduled",
        `OSA scheduled an on-site inspection for “${prev.dorm_name}” on ${inspDate}.`,
        "accreditation"
      );
    }

    if (status === "Approved" && prev.status !== "Approved") {
      await insertNotification(
        pool,
        prev.owner_user_id,
        "Accreditation approved",
        `Your application for “${prev.dorm_name}” has been approved.`,
        "accreditation"
      );
    }
    if (status === "Rejected" && prev.status !== "Rejected") {
      await insertNotification(
        pool,
        prev.owner_user_id,
        "Accreditation rejected",
        `Your application for “${prev.dorm_name}” was rejected.${remarks ? ` Note: ${remarks}` : ""}`,
        "accreditation"
      );
    }
    if (status === "Hold" && prev.status !== "Hold") {
      await insertNotification(
        pool,
        prev.owner_user_id,
        "Accreditation on hold",
        `Your application for “${prev.dorm_name}” is on hold.${remarks ? ` ${remarks}` : ""}`,
        "accreditation"
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
