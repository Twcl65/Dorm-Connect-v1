import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";
import { unpackReview } from "@/lib/review-content";

export const dynamic = "force-dynamic";

const CERT_LABELS: Record<string, string> = {
  businessPermit: "Business Permit",
  barangayClearance: "Barangay Clearance",
  fireSafetyCertificate: "Fire Safety Certificate",
  occupancyPermit: "Occupancy Permit",
  sanitaryPermit: "Sanitary Permit",
};

function extractCertifications(
  formData: unknown
): { label: string; url: string }[] {
  if (!formData) return [];
  let o: Record<string, unknown> | null = null;
  try {
    o =
      typeof formData === "string"
        ? (JSON.parse(formData) as Record<string, unknown>)
        : typeof formData === "object"
          ? (formData as Record<string, unknown>)
          : null;
  } catch {
    return [];
  }
  if (!o) return [];
  const out: { label: string; url: string }[] = [];
  const seen = new Set<string>();
  const add = (label: string, url: unknown) => {
    if (typeof url !== "string" || !url.trim() || seen.has(url)) return;
    seen.add(url);
    out.push({ label, url: url.trim() });
  };

  const owner = o.owner;
  if (owner && typeof owner === "object") {
    const ow = owner as Record<string, unknown>;
    add("Owner ID (front)", ow.ownerIdFrontUrl);
    add("Owner ID (back)", ow.ownerIdBackUrl);
  }

  const docs = o.documents;
  if (docs && typeof docs === "object") {
    const d = docs as Record<string, unknown>;
    for (const [key, label] of Object.entries(CERT_LABELS)) {
      const v = d[key];
      if (v && typeof v === "object") {
        add(label, (v as Record<string, unknown>).url);
      } else {
        add(label, v);
      }
    }
    const supporting = d.supporting;
    if (supporting && typeof supporting === "object") {
      const urls = (supporting as Record<string, unknown>).urls;
      if (Array.isArray(urls)) {
        urls.forEach((u, i) => add(`Supporting document ${i + 1}`, u));
      }
    }
  }
  if (Array.isArray(o.attachmentUrls)) {
    o.attachmentUrls.forEach((u, i) => add(`Attachment ${i + 1}`, u));
  }
  return out;
}

export async function GET(req: Request) {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const propertyId = new URL(req.url).searchParams.get("propertyId");
  if (!propertyId || !/^[0-9a-f-]{36}$/i.test(propertyId)) {
    return NextResponse.json({ error: "propertyId required." }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const { rows: props } = await pool.query<{
      id: string;
      name: string;
      address: string | null;
      city: string | null;
      contact_phone: string | null;
      description: string | null;
      landlord_user_id: string;
      landlord_name: string;
      gcash_account_name: string | null;
      gcash_phone: string | null;
      gcash_qr_code_url: string | null;
    }>(
      `SELECT p.id, p.name, p.address, p.city, p.contact_phone, p.description,
              u.id AS landlord_user_id, u.full_name AS landlord_name,
              u.gcash_account_name, u.gcash_phone, u.gcash_qr_code_url
       FROM public.landlord_properties p
       JOIN public.boarding_house_app_users u ON u.id = p.owner_user_id
       WHERE p.id = $1::uuid`,
      [propertyId]
    );
    const property = props[0];
    if (!property) {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }

    const { rows: accRows } = await pool.query<{
      status: string;
      dorm_name: string;
      submitted_at: Date;
      accreditation_expires_at: Date | null;
      form_data: unknown;
    }>(
      `SELECT status, dorm_name, submitted_at, accreditation_expires_at, form_data
       FROM public.landlord_accreditation_requests
       WHERE property_id = $1::uuid
       ORDER BY submitted_at DESC
       LIMIT 1`,
      [propertyId]
    );
    const acc = accRows[0];
    const certifications = extractCertifications(acc?.form_data);

    const { rows: reviews } = await pool.query<{
      author: string;
      created_at: Date;
      comment: string;
      rating: number;
      room_no: string;
      property_name: string;
    }>(
      `SELECT u.full_name AS author, v.created_at, v.comment, v.rating,
              r.room_no, p.name AS property_name
       FROM public.student_dorm_reviews v
       JOIN public.boarding_house_app_users u ON u.id = v.student_user_id
       JOIN public.landlord_rooms r ON r.id = v.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       WHERE r.owner_user_id = $1::uuid
       ORDER BY v.created_at DESC
       LIMIT 100`,
      [property.landlord_user_id]
    );

    const avg =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null;

    return NextResponse.json({
      landlord: {
        id: property.landlord_user_id,
        name: property.landlord_name,
        gcashAccountName: property.gcash_account_name?.trim() || null,
        gcashPhone: property.gcash_phone?.trim() || null,
        gcashQrCodeUrl: property.gcash_qr_code_url?.trim() || null,
      },
      property: {
        id: property.id,
        name: property.name,
        address: [property.address, property.city].filter(Boolean).join(", ") || "—",
        contactPhone: property.contact_phone?.trim() || null,
        description: property.description?.trim() || null,
      },
      accreditation: acc
        ? {
            status: acc.status,
            dormName: acc.dorm_name,
            submittedAt: new Date(acc.submitted_at).toISOString().slice(0, 10),
            expiresAt: acc.accreditation_expires_at
              ? new Date(acc.accreditation_expires_at).toISOString().slice(0, 10)
              : null,
          }
        : { status: "Not submitted", dormName: property.name, submittedAt: null, expiresAt: null },
      certifications,
      reviewSummary: { avg, count: reviews.length },
      reviews: reviews.map((r) => {
        const unpacked = unpackReview(r.comment);
        return {
          author: r.author,
          date: new Date(r.created_at).toISOString().slice(0, 10),
          title: unpacked.title,
          comment: unpacked.comment,
          rating: r.rating,
          roomNo: r.room_no,
          propertyName: r.property_name,
        };
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load landlord profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
