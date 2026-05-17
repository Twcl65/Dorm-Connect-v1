import { NextResponse } from "next/server";
import {
  accreditationApplicationBlockReason,
  canApplyForPropertyAccreditation,
} from "@/lib/accreditation-eligibility";
import { expireAccreditationsIfNeeded } from "@/lib/accreditation-expiry";
import { getPool } from "@/lib/db";
import { ensureLandlordProperty, landlordLog } from "@/lib/landlord-db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

function collectAttachmentUrls(formData: unknown): string[] {
  if (!formData || typeof formData !== "object") return [];
  const o = formData as Record<string, unknown>;
  const urls: string[] = [];
  const owner = o.owner;
  if (owner && typeof owner === "object") {
    const ow = owner as Record<string, unknown>;
    if (typeof ow.ownerIdFrontUrl === "string") urls.push(ow.ownerIdFrontUrl);
    if (typeof ow.ownerIdBackUrl === "string") urls.push(ow.ownerIdBackUrl);
  }
  const docs = o.documents;
  if (docs && typeof docs === "object") {
    const d = docs as Record<string, unknown>;
    for (const key of [
      "businessPermit",
      "barangayClearance",
      "fireSafetyCertificate",
      "occupancyPermit",
      "sanitaryPermit",
    ]) {
      const v = d[key];
      if (v && typeof v === "object") {
        const vv = v as Record<string, unknown>;
        if (typeof vv.url === "string") urls.push(vv.url);
      }
    }
    const supporting = d.supporting;
    if (supporting && typeof supporting === "object") {
      const s = supporting as Record<string, unknown>;
      if (Array.isArray(s.urls)) {
        for (const x of s.urls) if (typeof x === "string") urls.push(x);
      }
    }
  }
  if (Array.isArray(o.attachmentUrls)) {
    for (const x of o.attachmentUrls) if (typeof x === "string") urls.push(x);
  }
  // de-dupe
  return Array.from(new Set(urls));
}

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      id: string;
      dorm_name: string;
      address: string;
      documents_count: number;
      submitted_at: Date;
      status: string;
    }>(
      `SELECT id, dorm_name, address, documents_count, submitted_at, status
       FROM public.landlord_accreditation_requests
       WHERE owner_user_id = $1::uuid
       ORDER BY submitted_at DESC`,
      [ownerId]
    );

    return NextResponse.json({
      requests: rows.map((r) => ({
        id: r.id,
        dormName: r.dorm_name,
        address: r.address,
        documentsCount: r.documents_count,
        submittedDate: new Date(r.submitted_at).toISOString().slice(0, 10),
        status: r.status,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const body = (await req.json()) as {
      propertyId?: string;
      dormName?: string;
      address?: string;
      formData?: Record<string, unknown>;
    };
    const dormName = (body.dormName ?? "").trim();
    const address = (body.address ?? "").trim();
    if (!dormName || !address) {
      return NextResponse.json(
        { error: "Dorm name and address are required." },
        { status: 400 }
      );
    }
    const formData = body.formData ?? {};

    // Server-side validation: required uploads and required checkboxes
    const urls = collectAttachmentUrls(formData);
    const docsCount = urls.length;
    const errors: string[] = [];

    const owner = (formData.owner ?? {}) as Record<string, unknown>;
    if (typeof owner.ownerIdFrontUrl !== "string")
      errors.push("Owner ID front upload is required.");
    if (typeof owner.ownerIdBackUrl !== "string")
      errors.push("Owner ID back upload is required.");

    const docs = (formData.documents ?? {}) as Record<string, unknown>;
    const requiredDocKeys = [
      "businessPermit",
      "barangayClearance",
      "fireSafetyCertificate",
      "occupancyPermit",
    ] as const;
    for (const k of requiredDocKeys) {
      const v = docs[k];
      const url =
        v && typeof v === "object" ? (v as Record<string, unknown>).url : undefined;
      if (typeof url !== "string") {
        errors.push(`${k} upload is required.`);
      }
    }

    const safety = (formData.safety ?? {}) as Record<string, unknown>;
    for (const [k, label] of [
      ["exits", "Fire exits confirmation is required."],
      ["extinguishers", "Fire extinguishers confirmation is required."],
      ["contacts", "Emergency contacts confirmation is required."],
      ["rooms", "Room requirements confirmation is required."],
    ] as const) {
      if (safety[k] !== true) errors.push(label);
    }

    const declaration = (formData.declaration ?? {}) as Record<string, unknown>;
    const declName = (declaration.name ?? "").toString().trim();
    if (!declName) errors.push("Applicant name is required.");

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors[0], details: errors },
        { status: 400 }
      );
    }

    const pool = await getPool();
    await expireAccreditationsIfNeeded(pool);

    let propertyId: string;
    const rawPid = (body.propertyId ?? "").trim();
    if (rawPid && /^[0-9a-f-]{36}$/i.test(rawPid)) {
      const { rows: pr } = await pool.query<{ id: string }>(
        `SELECT id FROM public.landlord_properties
         WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
        [rawPid, ownerId]
      );
      if (!pr[0]) {
        return NextResponse.json({ error: "Invalid property." }, { status: 400 });
      }

      const { rows: accRows } = await pool.query<{
        status: string;
        submitted_at: Date;
        accreditation_expires_at: Date | null;
      }>(
        `SELECT status, submitted_at, accreditation_expires_at
         FROM public.landlord_accreditation_requests
         WHERE owner_user_id = $1::uuid AND property_id = $2::uuid
         ORDER BY submitted_at DESC
         LIMIT 1`,
        [ownerId, rawPid]
      );
      const latest = accRows[0]
        ? {
            status: accRows[0].status,
            submittedAt: accRows[0].submitted_at,
            accreditationExpiresAt: accRows[0].accreditation_expires_at,
          }
        : null;
      if (!canApplyForPropertyAccreditation(latest)) {
        return NextResponse.json(
          {
            error:
              accreditationApplicationBlockReason(latest) ??
              "This property is not eligible for a new accreditation application.",
          },
          { status: 400 }
        );
      }

      propertyId = rawPid;
    } else {
      propertyId = await ensureLandlordProperty(pool, ownerId);
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.landlord_accreditation_requests
        (owner_user_id, property_id, dorm_name, address, documents_count, form_data, status)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, 'Pending')
       RETURNING id`,
      [ownerId, propertyId, dormName, address, docsCount, JSON.stringify(formData)]
    );

    await landlordLog(
      pool,
      ownerId,
      `Submitted accreditation: ${dormName}`
    );
    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to submit";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
