import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { insertNotification } from "@/lib/notify-user";
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
      property_id: string | null;
      dorm_name: string;
      address: string;
      status: string;
      documents_count: number;
      submitted_at: Date;
      updated_at: Date;
      accreditation_expires_at: Date | null;
      form_data: unknown;
      owner_name: string;
      landlord_location: string | null;
    }>(
      `SELECT a.id, a.property_id, a.dorm_name, a.address, a.status, a.documents_count,
              a.submitted_at, a.updated_at, a.accreditation_expires_at, a.form_data,
              u.full_name AS owner_name, p.address AS landlord_location
       FROM public.landlord_accreditation_requests a
       JOIN public.boarding_house_app_users u ON u.id = a.owner_user_id
       LEFT JOIN public.landlord_properties p ON p.id = a.property_id
       WHERE a.id = $1::uuid AND a.owner_user_id = $2::uuid`,
      [id, ownerId]
    );
    const r = rows[0];
    if (!r) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    let signatory = {
      signatory_name: "OSA Authorized Representative",
      signatory_title: "Office of Student Affairs",
      campus: "USTP Jasaan Campus",
      campus_director_name: "Campus Director",
    };
    try {
      const { rows: signatoryRows } = await pool.query<{
        signatory_name: string;
        signatory_title: string;
        campus: string;
        campus_director_name: string;
      }>(
        `SELECT signatory_name, signatory_title, campus, campus_director_name
         FROM public.osa_signatory_config
         ORDER BY id DESC
         LIMIT 1`
      );
      if (signatoryRows[0]) signatory = signatoryRows[0];
    } catch {
      // Use certificate defaults if signatory settings are unavailable.
    }

    return NextResponse.json({
      id: r.id,
      propertyId: r.property_id,
      dormName: r.dorm_name,
      address: r.address,
      status: r.status,
      documentsCount: r.documents_count,
      submittedAt: new Date(r.submitted_at).toISOString().slice(0, 10),
      updatedAt: new Date(r.updated_at).toISOString().slice(0, 10),
      accreditationExpiresAt: r.accreditation_expires_at
        ? new Date(r.accreditation_expires_at).toISOString().slice(0, 10)
        : null,
      formData: r.form_data,
      landlordName: r.owner_name,
      landlordLocation: r.landlord_location ?? r.address,
      signatoryName: signatory.signatory_name,
      signatoryTitle: signatory.signatory_title,
      campus: signatory.campus,
      campusDirectorName: signatory.campus_director_name,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Ctx) {
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
    const body = (await req.json()) as {
      status?: string;
      remarks?: string;
      documents?: Array<{
        mimeType?: string;
        fileName: string;
        fileUrl?: string;
        documentKey?: string;
        additionalDocumentIndex?: number;
      }>;
      inspectionScheduleAction?: "approve" | "change";
      inspectionScheduleDate?: string;
    };

    if (body.inspectionScheduleAction) {
      if (!["approve", "change"].includes(body.inspectionScheduleAction)) {
        return NextResponse.json({ error: "Invalid schedule response." }, { status: 400 });
      }

      const pool = await getPool();
      const { rows } = await pool.query<{
        status: string;
        form_data: unknown;
      }>(
        `SELECT status, form_data
         FROM public.landlord_accreditation_requests
         WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
        [id, ownerId]
      );
      const request = rows[0];
      if (!request) {
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }

      const formData =
        request.form_data && typeof request.form_data === "object"
          ? (request.form_data as Record<string, unknown>)
          : {};
      const proposal = formData.inspection_schedule_proposal as
        | { proposedDate?: string; status?: string }
        | undefined;
      if (!proposal || proposal.status !== "pending" || !proposal.proposedDate) {
        return NextResponse.json(
          { error: "There is no pending inspection date to respond to." },
          { status: 409 }
        );
      }

      const confirmedDate =
        body.inspectionScheduleAction === "approve"
          ? proposal.proposedDate
          : (body.inspectionScheduleDate ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(confirmedDate)) {
        return NextResponse.json({ error: "Choose a valid inspection date." }, { status: 400 });
      }

      const response = {
        ...proposal,
        status: "confirmed",
        confirmedDate,
        response: body.inspectionScheduleAction,
      };
      const updated = await pool.query(
        `UPDATE public.landlord_accreditation_requests
         SET status = 'Scheduled for Inspection',
             inspection_scheduled_for = $1::date,
             form_data = jsonb_set(
               COALESCE(form_data, '{}'::jsonb),
               '{inspection_schedule_proposal}',
               $2::jsonb,
               true
             ),
             updated_at = now()
         WHERE id = $3::uuid
           AND owner_user_id = $4::uuid
           AND form_data #>> '{inspection_schedule_proposal,status}' = 'pending'`,
        [confirmedDate, JSON.stringify(response), id, ownerId]
      );
      if (updated.rowCount === 0) {
        return NextResponse.json(
          { error: "This inspection date has already been handled." },
          { status: 409 }
        );
      }

      const rescheduled = await pool.query(
        `UPDATE public.os_accredit_inspections
         SET scheduled_for = $1::date, updated_at = now()
         WHERE id = (
           SELECT id FROM public.os_accredit_inspections
           WHERE accreditation_request_id = $2::uuid
           ORDER BY created_at DESC
           LIMIT 1
         )`,
        [confirmedDate, id]
      );
      if (rescheduled.rowCount === 0) {
        await pool.query(
          `INSERT INTO public.os_accredit_inspections
             (accreditation_request_id, scheduled_for)
           VALUES ($1::uuid, $2::date)`,
          [id, confirmedDate]
        );
      }

      return NextResponse.json({ ok: true, inspectionScheduledFor: confirmedDate });
    }

    const documents = Array.isArray(body.documents) ? body.documents : null;
    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: "No documents provided." }, { status: 400 });
    }
    if (
      documents.some(
        (document) =>
          !document ||
          typeof document.fileName !== "string" ||
          !document.fileName.trim() ||
          typeof document.fileUrl !== "string" ||
          !document.fileUrl.trim()
      )
    ) {
      return NextResponse.json(
        { error: "Every document must include a file name and uploaded file." },
        { status: 400 }
      );
    }

    const pool = await getPool();
    const { rows } = await pool.query<{
      status: string;
      form_data: unknown;
      documents_count: number;
      dorm_name: string;
    }>(
      `SELECT status, form_data, documents_count, dorm_name
       FROM public.landlord_accreditation_requests
       WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
      [id, ownerId]
    );
    const r = rows[0];
    if (!r) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const currentFormData: Record<string, unknown> =
      r.form_data && typeof r.form_data === "object" ? (r.form_data as Record<string, unknown>) : {};
    const existingDocs =
      currentFormData.documents && typeof currentFormData.documents === "object"
        ? (currentFormData.documents as Record<string, unknown>)
        : {};
    const existingAdditionalDocuments = Array.isArray(
      currentFormData.additional_documents
    )
      ? currentFormData.additional_documents
      : [];
    const canEditPendingDocuments =
      currentFormData.landlord_document_revision_open === true ||
      existingAdditionalDocuments.length > 0;
    if (r.status !== "Hold" && !(r.status === "Pending" && canEditPendingDocuments)) {
      return NextResponse.json(
        { error: "Documents can only be updated while the request is on hold or awaiting OSA review." },
        { status: 409 }
      );
    }
    const allowedDocumentKeys = new Set([
      "businessPermit",
      "barangayClearance",
      "fireSafetyCertificate",
      "occupancyPermit",
      "sanitaryPermit",
    ]);
    const replacements = documents.filter(
      (document) =>
        "documentKey" in document &&
        typeof document.documentKey === "string" &&
        allowedDocumentKeys.has(document.documentKey)
    );
    const additionalReplacements = documents.filter(
      (document) => document.additionalDocumentIndex !== undefined
    );
    const additions = documents.filter(
      (document) =>
        !("documentKey" in document && document.documentKey) &&
        document.additionalDocumentIndex === undefined
    );
    if (
      documents.some(
        (document) =>
          "documentKey" in document &&
          document.documentKey !== undefined &&
          (typeof document.documentKey !== "string" ||
            !allowedDocumentKeys.has(document.documentKey))
      )
    ) {
      return NextResponse.json({ error: "Invalid accreditation document type." }, { status: 400 });
    }
    if (
      additionalReplacements.some(
        (document) =>
          !Number.isInteger(document.additionalDocumentIndex) ||
          document.additionalDocumentIndex! < 0 ||
          document.additionalDocumentIndex! >= existingAdditionalDocuments.length
      )
    ) {
      return NextResponse.json(
        { error: "Invalid supplemental document to replace." },
        { status: 400 }
      );
    }

    const updatedDocuments = { ...existingDocs };
    for (const document of replacements) {
      const key = document.documentKey as string;
      updatedDocuments[key] = {
        fileName: document.fileName,
        mimeType: document.mimeType,
        url: document.fileUrl!.trim(),
      };
    }
    const additionalDocuments = [...existingAdditionalDocuments];
    for (const document of additionalReplacements) {
      const index = document.additionalDocumentIndex!;
      additionalDocuments[index] = {
        fileName: document.fileName,
        mimeType: document.mimeType,
        fileUrl: document.fileUrl!.trim(),
      };
    }
    additionalDocuments.push(...additions);
    const owner = currentFormData.owner;
    const ownerData =
      owner && typeof owner === "object"
        ? (owner as Record<string, unknown>)
        : {};
    const replacedUrls = new Set([
      ...replacements.flatMap((document) => {
        if (!document.documentKey) return [];
        const previous = existingDocs[document.documentKey];
        if (typeof previous === "string") return [previous];
        if (!previous || typeof previous !== "object") return [];
        const previousValue = previous as Record<string, unknown>;
        const previousUrl = previousValue.url ?? previousValue.fileUrl;
        return typeof previousUrl === "string" ? [previousUrl] : [];
      }),
      ...additionalReplacements.flatMap((document) => {
        const previous =
          existingAdditionalDocuments[document.additionalDocumentIndex!];
        if (typeof previous === "string") return [previous];
        if (!previous || typeof previous !== "object") return [];
        const value = previous as Record<string, unknown>;
        const url = value.fileUrl ?? value.url;
        return typeof url === "string" ? [url] : [];
      }),
    ]);
    const legacyAttachmentUrls = Array.isArray(currentFormData.attachmentUrls)
      ? currentFormData.attachmentUrls.filter(
          (url): url is string =>
            typeof url === "string" && !replacedUrls.has(url)
        )
      : [];
    const attachmentUrls = Array.from(
      new Set(
        [
          ...legacyAttachmentUrls,
          ownerData.ownerIdFrontUrl,
          ownerData.ownerIdBackUrl,
          ...[...allowedDocumentKeys].flatMap((key) => {
              const document = updatedDocuments[key];
              if (!document || typeof document !== "object") return [];
              const url = (document as Record<string, unknown>).url;
              return typeof url === "string" ? [url] : [];
            }),
          ...(() => {
            const supporting = updatedDocuments.supporting;
            if (!supporting || typeof supporting !== "object") return [];
            const urls = (supporting as Record<string, unknown>).urls;
            return Array.isArray(urls)
              ? urls.filter((url): url is string => typeof url === "string")
              : [];
          })(),
          ...additionalDocuments.flatMap((document) => {
            if (typeof document === "string") return [document];
            if (!document || typeof document !== "object") return [];
            const value = document as Record<string, unknown>;
            const url = value.fileUrl ?? value.url;
            return typeof url === "string" ? [url] : [];
          }),
        ].filter((url): url is string => typeof url === "string" && !!url.trim())
      )
    );

    const updatedFormData = {
      ...currentFormData,
      documents: updatedDocuments,
      additional_documents: additionalDocuments,
      landlord_document_revision_open: true,
      attachmentUrls,
    };

    const updated = await pool.query(
      `UPDATE public.landlord_accreditation_requests
       SET form_data = $1::jsonb,
           documents_count = $2,
           status = 'Pending',
           updated_at = now()
       WHERE id = $3::uuid AND owner_user_id = $4::uuid
         AND (
           status = 'Hold'
           OR (
             status = 'Pending'
             AND (
               form_data->>'landlord_document_revision_open' = 'true'
               OR jsonb_array_length(
                 CASE
                   WHEN jsonb_typeof(form_data->'additional_documents') = 'array'
                     THEN form_data->'additional_documents'
                   ELSE '[]'::jsonb
                 END
               ) > 0
             )
           )
         )
       RETURNING id`,
      [
        JSON.stringify(updatedFormData),
        attachmentUrls.length,
        id,
        ownerId,
      ]
    );
    if (updated.rowCount === 0) {
      return NextResponse.json(
        { error: "This request is no longer eligible for document updates." },
        { status: 409 }
      );
    }

    try {
      const landlordName = session.name?.trim() || "A landlord";
      const { rows: osaAdmins } = await pool.query<{ id: string }>(
        `SELECT id FROM public.boarding_house_app_users
         WHERE status = 'Active' AND role = 'OSA/SAS Admin'`
      );
      for (const admin of osaAdmins) {
        await insertNotification(
          pool,
          admin.id,
          "Additional accreditation documents submitted",
          `${landlordName} submitted additional documents for "${r.dorm_name}". Review the updated request.`,
          "accreditation"
        );
      }
    } catch (notifyErr) {
      console.error(
        "[landlord-accreditation] Failed to notify OSA about additional documents:",
        notifyErr
      );
    }

    return NextResponse.json({
      id,
      status: "Pending",
      documentsCount: attachmentUrls.length,
      documents,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
