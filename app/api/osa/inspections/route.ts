import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  INSPECTION_RESULTS,
  mergeChecklist,
  OSA_INSPECTION_CHECKLIST,
  parseLandlordSafetyDeclaration,
  type InspectionResult,
} from "@/lib/osa-inspection";
import { requireOsaAdmin } from "@/lib/require-osa";
import { insertNotification } from "@/lib/notify-user";

export const dynamic = "force-dynamic";

const RESULTS = new Set<string>(INSPECTION_RESULTS);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const session = await requireOsaAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      inspection_id: string | null;
      accreditation_request_id: string;
      dorm_name: string;
      address: string;
      application_status: string;
      owner_name: string;
      owner_email: string;
      scheduled_for: string | null;
      inspection_scheduled_for: string | null;
      completed_at: Date | null;
      result: string | null;
      notes: string | null;
      checklist: unknown;
      form_data: unknown;
    }>(
      `SELECT
         i.id AS inspection_id,
         a.id AS accreditation_request_id,
         a.dorm_name,
         a.address,
         a.status AS application_status,
         u.full_name AS owner_name,
         u.email AS owner_email,
         i.scheduled_for::text AS scheduled_for,
         a.inspection_scheduled_for::text AS inspection_scheduled_for,
         i.completed_at,
         i.result,
         i.notes,
         i.checklist,
         a.form_data
       FROM public.landlord_accreditation_requests a
       JOIN public.boarding_house_app_users u ON u.id = a.owner_user_id
       LEFT JOIN LATERAL (
         SELECT *
         FROM public.os_accredit_inspections
         WHERE accreditation_request_id = a.id
         ORDER BY scheduled_for DESC, created_at DESC
         LIMIT 1
       ) i ON true
       WHERE a.inspection_scheduled_for IS NOT NULL
          OR i.id IS NOT NULL
          OR a.status IN (
            'Scheduled for Inspection',
            'Recommended for Approval',
            'Hold',
            'Rejected'
          )
       ORDER BY COALESCE(i.scheduled_for, a.inspection_scheduled_for) DESC NULLS LAST,
                a.submitted_at DESC`
    );

    const today = todayStr();
    const schedules = rows.map((r) => {
      const scheduledFor =
        r.scheduled_for ?? r.inspection_scheduled_for ?? null;
      const completed = r.completed_at != null;
      let scheduleStatus: "upcoming" | "completed" | "overdue" = "upcoming";
      if (completed) {
        scheduleStatus = "completed";
      } else if (scheduledFor && scheduledFor < today) {
        scheduleStatus = "overdue";
      }

      return {
        inspectionId: r.inspection_id,
        accreditationRequestId: r.accreditation_request_id,
        dormName: r.dorm_name,
        address: r.address,
        ownerName: r.owner_name,
        ownerEmail: r.owner_email,
        applicationStatus: r.application_status,
        scheduledFor,
        scheduleStatus,
        result: r.result,
        notes: r.notes ?? "",
        completedAt: r.completed_at
          ? new Date(r.completed_at).toISOString()
          : null,
        checklist: mergeChecklist(
          r.checklist as Record<string, boolean> | null
        ),
        landlordDeclaration: parseLandlordSafetyDeclaration(r.form_data),
        canRecordResult:
          !completed &&
          (r.application_status === "Scheduled for Inspection" ||
            scheduledFor != null),
      };
    });

    const recommended = schedules.filter(
      (s) => s.result === "Recommended for Approval"
    ).length;
    const rejected = schedules.filter((s) => s.result === "Rejected").length;
    const onHold = schedules.filter((s) => s.result === "Hold").length;
    const upcoming = schedules.filter(
      (s) => s.scheduleStatus === "upcoming" || s.scheduleStatus === "overdue"
    ).length;

    return NextResponse.json({
      summary: { recommended, rejected, onHold, upcoming },
      schedules,
      checklistTemplate: OSA_INSPECTION_CHECKLIST,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load inspections";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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
      holdReason?: string;
    };
    const accId = (body.accreditationRequestId ?? "").trim();
    const result =
      body.result && RESULTS.has(body.result)
        ? (body.result as InspectionResult)
        : null;
    if (!accId || !/^[0-9a-f-]{36}$/i.test(accId) || !result) {
      return NextResponse.json(
        { error: "accreditationRequestId and valid result are required." },
        { status: 400 }
      );
    }

    const holdReason = (body.holdReason ?? "").trim();
    let notes = (body.notes ?? "").trim();

    if (result === "Hold" && !holdReason) {
      return NextResponse.json(
        { error: "On hold reason is required." },
        { status: 400 }
      );
    }
    if (result === "Rejected" && !notes) {
      return NextResponse.json(
        { error: "Rejection reason is required." },
        { status: 400 }
      );
    }

    if (result === "Hold") {
      notes = notes
        ? `On hold: ${holdReason}\n${notes}`
        : `On hold: ${holdReason}`;
    }

    const checklist = mergeChecklist(body.checklist);
    const allChecked = OSA_INSPECTION_CHECKLIST.every(
      (item) => checklist[item.key]
    );
    if (result === "Recommended for Approval" && !allChecked) {
      return NextResponse.json(
        {
          error:
            "All checklist items must be verified before recommending for approval.",
        },
        { status: 400 }
      );
    }

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

    let nextStatus: InspectionResult = "Hold";
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
        JSON.stringify({
          inspection_notes: notes,
          inspection_checklist: checklist,
          ...(result === "Hold" ? { inspection_hold_reason: holdReason } : {}),
        }),
        accId,
      ]
    );

    const displayResult =
      result === "Hold" ? "On Hold" : result;

    await insertNotification(
      pool,
      a.owner_user_id,
      "Inspection result",
      `Inspection for “${a.dorm_name}”: ${displayResult}.${notes ? ` ${notes}` : ""}`,
      "accreditation"
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save inspection";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
