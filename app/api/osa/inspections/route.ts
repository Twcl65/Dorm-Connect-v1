import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  INSPECTION_RESULTS,
  mergeChecklist,
  OSA_INSPECTION_CHECKLIST,
  parseLandlordSafetyDeclaration,
  type InspectionResult,
} from "@/lib/osa-inspection";
import { requireOsaStaff } from "@/lib/require-osa";
import { insertNotification } from "@/lib/notify-user";

export const dynamic = "force-dynamic";

const RESULTS = new Set<string>(INSPECTION_RESULTS);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type FollowupDocument = {
  fileName: string;
  url: string;
  mimeType: string;
};

function readStaffFollowupDocuments(formData: unknown): FollowupDocument[] {
  if (!formData || typeof formData !== "object") return [];
  const data = formData as Record<string, unknown>;
  if (data.inspection_hold_source !== "staff") return [];
  if (!Array.isArray(data.staff_inspection_followup_documents)) return [];
  return data.staff_inspection_followup_documents.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const url = value.url ?? value.fileUrl;
    if (typeof url !== "string" || !url.trim()) return [];
    return [
      {
        fileName:
          typeof value.fileName === "string" && value.fileName.trim()
            ? value.fileName.trim()
            : "Added document",
        url: url.trim(),
        mimeType: typeof value.mimeType === "string" ? value.mimeType : "",
      },
    ];
  });
}

export async function GET() {
  const session = await requireOsaStaff();
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
         ORDER BY
           CASE
             WHEN a.status = 'Scheduled for Inspection' AND completed_at IS NULL THEN 0
             ELSE 1
           END,
           scheduled_for DESC,
           created_at DESC
         LIMIT 1
       ) i ON true
       WHERE a.inspection_scheduled_for IS NOT NULL
          OR i.id IS NOT NULL
          OR a.status IN (
            'Renewing',
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
      const storedScheduledFor =
        r.scheduled_for ?? r.inspection_scheduled_for ?? null;
      const scheduledForDate = storedScheduledFor?.slice(0, 10) ?? null;
      // A hold stays completed until the landlord sends the requested documents.
      // Once that happens the application is scheduled again, even if an older
      // completed inspection row is still the latest stored visit.
      const reopenedAfterDocuments =
        r.application_status === "Scheduled for Inspection" &&
        r.completed_at != null;
      const scheduledFor = reopenedAfterDocuments ? today : scheduledForDate;
      const completed = r.completed_at != null && !reopenedAfterDocuments;
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
        result: reopenedAfterDocuments ? null : r.result,
        notes: reopenedAfterDocuments ? "" : (r.notes ?? ""),
        completedAt:
          completed && r.completed_at
            ? new Date(r.completed_at).toISOString()
            : null,
        checklist: mergeChecklist(
          reopenedAfterDocuments
            ? null
            : (r.checklist as Record<string, boolean> | null)
        ),
        landlordDeclaration: parseLandlordSafetyDeclaration(r.form_data),
        followupDocuments: readStaffFollowupDocuments(r.form_data),
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
  const session = await requireOsaStaff();
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
      status: string;
    }>(
      `SELECT owner_user_id, dorm_name, status FROM public.landlord_accreditation_requests WHERE id = $1::uuid`,
      [accId]
    );
    const a = acc[0];
    if (!a) {
      return NextResponse.json({ error: "Accreditation not found." }, { status: 404 });
    }

    const { rows: insp } = await pool.query<{ id: string; completed_at: Date | null }>(
      `SELECT id, completed_at
       FROM public.os_accredit_inspections
       WHERE accreditation_request_id = $1::uuid
         AND (
           completed_at IS NULL
           OR $2::boolean
         )
       ORDER BY
         CASE WHEN completed_at IS NULL THEN 0 ELSE 1 END,
         scheduled_for DESC,
         created_at DESC
       LIMIT 1`,
      [accId, a.status === "Scheduled for Inspection"]
    );
    const inspId = insp[0]?.id;
    if (inspId) {
      await pool.query(
        `UPDATE public.os_accredit_inspections
         SET completed_at = now(),
             result = $1,
             checklist = $2::jsonb,
             notes = $3,
             scheduled_for = CASE
               WHEN $5::boolean AND completed_at IS NOT NULL THEN CURRENT_DATE
               ELSE scheduled_for
             END,
             updated_at = now()
         WHERE id = $4::uuid`,
        [
          result,
          JSON.stringify(checklist),
          notes,
          inspId,
          a.status === "Scheduled for Inspection",
        ]
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
          inspection_result: result,
          inspection_notes: notes,
          inspection_checklist: checklist,
          inspection_prepared_by: session.name,
          inspection_prepared_by_role: session.role,
          inspection_prepared_by_user_id: session.sub,
          inspection_hold_source:
            result === "Hold" && session.role === "Staff" ? "staff" : null,
          staff_inspection_followup_documents: [],
          ...(result === "Hold" ? { inspection_hold_reason: holdReason } : {}),
        }),
        accId,
      ]
    );

    const landlordNotification =
      result === "Hold"
        ? {
            title: "Inspection placed on hold",
            body: `The inspection for “${a.dorm_name}” is on hold. Reason: ${holdReason}`,
          }
        : result === "Rejected"
          ? {
              title: "Inspection rejected",
              body: `The inspection for “${a.dorm_name}” was rejected. Reason: ${notes}`,
            }
          : {
              title: "Inspection recommended for approval",
              body: `The inspection for “${a.dorm_name}” was recommended for approval.`,
            };

    await insertNotification(
      pool,
      a.owner_user_id,
      landlordNotification.title,
      landlordNotification.body,
      "inspection"
    );

    if (
      session.role === "Staff" &&
      (result === "Hold" || result === "Rejected")
    ) {
      const { rows: osaUsers } = await pool.query<{ id: string }>(
        `SELECT id
         FROM public.boarding_house_app_users
         WHERE status = 'Active'
           AND role = 'OSA/SAS Admin'
           AND id <> $1::uuid`,
        [session.sub]
      );
      const staffName = session.name?.trim() || "Staff";
      for (const osaUser of osaUsers) {
        await insertNotification(
          pool,
          osaUser.id,
          result === "Hold"
            ? "Inspection placed on hold"
            : "Inspection rejected",
          result === "Hold"
            ? `${staffName} placed the inspection for “${a.dorm_name}” on hold. Reason: ${holdReason}`
            : `${staffName} rejected the inspection for “${a.dorm_name}”. Reason: ${notes}`,
          "inspection"
        );
      }
      await insertNotification(
        pool,
        session.sub,
        result === "Hold"
          ? "Visit the dormitory again"
          : "Inspection rejected",
        result === "Hold"
          ? `You placed the inspection for “${a.dorm_name}” on hold. Visit the dormitory again after the landlord submits the requested documents or pictures.`
          : `You rejected the inspection for “${a.dorm_name}”. Reason: ${notes}`,
        "inspection"
      );
    } else if (
      session.role === "Staff" &&
      result === "Recommended for Approval"
    ) {
      const { rows: osaUsers } = await pool.query<{ id: string }>(
        `SELECT id
         FROM public.boarding_house_app_users
         WHERE status = 'Active' AND role = 'OSA/SAS Admin'`
      );
      for (const osaUser of osaUsers) {
        await insertNotification(
          pool,
          osaUser.id,
          "Inspection recommended for approval",
          `Staff recommended “${a.dorm_name}” for accreditation approval after inspection.`,
          "inspection"
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save inspection";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
