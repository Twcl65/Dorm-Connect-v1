import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireOsaAdmin } from "@/lib/require-osa";
import { insertNotification } from "@/lib/notify-user";

export const dynamic = "force-dynamic";

const DEFAULT_CHECKLIST = {
  fireExtinguisher: false,
  emergencyExits: false,
  sanitation: false,
  electricalSafety: false,
  occupancyCompliance: false,
};

const RESULTS = new Set([
  "Recommended for Approval",
  "Hold",
  "Rejected",
]);

/** Complete or update the latest scheduled inspection for an accreditation request. */
export async function POST(req: Request) {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      accreditationRequestId?: string;
      result?: string;
      checklist?: Record<string, boolean>;
      notes?: string;
    };
    const accId = (body.accreditationRequestId ?? "").trim();
    const result = body.result && RESULTS.has(body.result) ? body.result : null;
    if (!accId || !/^[0-9a-f-]{36}$/i.test(accId) || !result) {
      return NextResponse.json(
        { error: "accreditationRequestId and valid result are required." },
        { status: 400 }
      );
    }

    const checklist = {
      ...DEFAULT_CHECKLIST,
      ...(body.checklist && typeof body.checklist === "object" ? body.checklist : {}),
    };
    const notes = (body.notes ?? "").trim();

    const pool = await getPool();
    const { rows: acc } = await pool.query<{
      owner_user_id: string;
      dorm_name: string;
    }>(
      `SELECT owner_user_id, dorm_name FROM public.landlord_accreditation_requests WHERE id = $1::uuid`,
      [accId]
    );
    const a = acc[0];
    if (!a) {
      return NextResponse.json({ error: "Accreditation not found." }, { status: 404 });
    }

    const { rows: insp } = await pool.query<{ id: string }>(
      `SELECT id FROM public.os_accredit_inspections
       WHERE accreditation_request_id = $1::uuid AND completed_at IS NULL
       ORDER BY scheduled_for DESC
       LIMIT 1`,
      [accId]
    );
    const inspId = insp[0]?.id;
    if (inspId) {
      await pool.query(
        `UPDATE public.os_accredit_inspections
         SET completed_at = now(), result = $1, checklist = $2::jsonb, notes = $3, updated_at = now()
         WHERE id = $4::uuid`,
        [result, JSON.stringify(checklist), notes, inspId]
      );
    } else {
      await pool.query(
        `INSERT INTO public.os_accredit_inspections
          (accreditation_request_id, scheduled_for, completed_at, result, checklist, notes)
         VALUES ($1::uuid, CURRENT_DATE, now(), $2, $3::jsonb, $4)`,
        [accId, result, JSON.stringify(checklist), notes]
      );
    }

    let nextStatus = "Hold";
    if (result === "Recommended for Approval") {
      nextStatus = "Recommended for Approval";
    } else if (result === "Rejected") {
      nextStatus = "Rejected";
    }

    await pool.query(
      `UPDATE public.landlord_accreditation_requests
       SET status = $1, updated_at = now(),
           form_data = COALESCE(form_data, '{}'::jsonb) || $2::jsonb
       WHERE id = $3::uuid`,
      [
        nextStatus,
        JSON.stringify({ inspection_notes: notes, inspection_checklist: checklist }),
        accId,
      ]
    );

    await insertNotification(
      pool,
      a.owner_user_id,
      "Inspection result",
      `Inspection for “${a.dorm_name}”: ${result}.${notes ? ` ${notes}` : ""}`,
      "accreditation"
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save inspection";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
