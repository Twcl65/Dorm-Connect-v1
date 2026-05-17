import { NextResponse } from "next/server";
import {
  canApplyForPropertyAccreditation,
} from "@/lib/accreditation-eligibility";
import { expireAccreditationsIfNeeded } from "@/lib/accreditation-expiry";
import { getPool } from "@/lib/db";
import { landlordLog } from "@/lib/landlord-db";
import { requireLandlord } from "@/lib/require-owner";
import {
  filterAllowedStoredFileUrls,
  isAllowedStoredFileUrl,
} from "@/lib/upload-url";

export const dynamic = "force-dynamic";

function parseGallery(v: unknown): string[] {
  return filterAllowedStoredFileUrls(v);
}

export async function GET(req: Request) {
  const session = await requireLandlord();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const forAccreditation =
    new URL(req.url).searchParams.get("forAccreditation") === "true";

  try {
    const pool = await getPool();
    if (forAccreditation) {
      await expireAccreditationsIfNeeded(pool);
    }
    const { rows } = await pool.query<{
      id: string;
      name: string;
      address: string | null;
      city: string | null;
      contact_phone: string | null;
      contact_email: string | null;
      property_type: string;
      description: string;
      total_rooms: number | null;
      max_occupancy_capacity: number | null;
      latitude: number | null;
      longitude: number | null;
      cover_image_url: string | null;
      gallery_image_urls: unknown;
      operational_status: string;
      created_at: Date;
    }>(
      `SELECT id, name, address, city, contact_phone, contact_email,
              property_type, description, total_rooms, max_occupancy_capacity,
              latitude, longitude, cover_image_url, gallery_image_urls,
              operational_status, created_at
       FROM public.landlord_properties
       WHERE owner_user_id = $1::uuid
       ORDER BY created_at ASC`,
      [session.sub]
    );

    const mapped = rows.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      city: r.city,
      contactPhone: r.contact_phone,
      contactEmail: r.contact_email,
      propertyType: r.property_type,
      description: r.description ?? "",
      totalRooms: r.total_rooms,
      maxOccupancyCapacity: r.max_occupancy_capacity,
      latitude: r.latitude,
      longitude: r.longitude,
      coverImageUrl: r.cover_image_url,
      galleryImageUrls: Array.isArray(r.gallery_image_urls)
        ? (r.gallery_image_urls as string[])
        : [],
      operationalStatus: r.operational_status,
      createdAt: r.created_at.toISOString(),
    }));

    if (!forAccreditation) {
      return NextResponse.json({ properties: mapped });
    }

    const { rows: accRows } = await pool.query<{
      property_id: string;
      status: string;
      submitted_at: Date;
      accreditation_expires_at: Date | null;
    }>(
      `SELECT DISTINCT ON (a.property_id)
              a.property_id, a.status, a.submitted_at, a.accreditation_expires_at
       FROM public.landlord_accreditation_requests a
       WHERE a.owner_user_id = $1::uuid
         AND a.property_id IS NOT NULL
       ORDER BY a.property_id, a.submitted_at DESC`,
      [session.sub]
    );

    const latestByProperty = new Map(
      accRows.map((a) => [
        a.property_id,
        {
          status: a.status,
          submittedAt: a.submitted_at,
          accreditationExpiresAt: a.accreditation_expires_at,
        },
      ])
    );

    const properties = mapped.filter((p) =>
      canApplyForPropertyAccreditation(latestByProperty.get(p.id))
    );

    return NextResponse.json({
      properties,
      totalProperties: mapped.length,
      ineligibleCount: mapped.length - properties.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireLandlord();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      propertyType?: string;
      description?: string;
      address?: string;
      city?: string | null;
      contactPhone?: string | null;
      contactEmail?: string | null;
      totalRooms?: number | null;
      maxOccupancyCapacity?: number | null;
      latitude?: number | null;
      longitude?: number | null;
      coverImageUrl?: string | null;
      galleryImageUrls?: string[];
    };

    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Property name is required." }, { status: 400 });
    }
    const propertyType =
      body.propertyType === "Boarding House" ? "Boarding House" : "Dormitory";
    const description = (body.description ?? "").trim();
    const address = (body.address ?? "").trim() || null;
    const city = body.city != null ? String(body.city).trim() || null : null;
    const contactPhone =
      body.contactPhone != null ? String(body.contactPhone).trim() || null : null;
    const contactEmail =
      body.contactEmail != null ? String(body.contactEmail).trim() || null : null;
    const totalRooms =
      body.totalRooms != null && Number.isFinite(body.totalRooms)
        ? Math.max(0, Math.floor(Number(body.totalRooms)))
        : null;
    const maxOccupancyCapacity =
      body.maxOccupancyCapacity != null &&
      Number.isFinite(body.maxOccupancyCapacity)
        ? Math.max(0, Math.floor(Number(body.maxOccupancyCapacity)))
        : null;

    let lat: number | null =
      body.latitude != null && Number.isFinite(Number(body.latitude))
        ? Number(body.latitude)
        : null;
    let lng: number | null =
      body.longitude != null && Number.isFinite(Number(body.longitude))
        ? Number(body.longitude)
        : null;
    if (lat !== null && (lat < -90 || lat > 90)) lat = null;
    if (lng !== null && (lng < -180 || lng > 180)) lng = null;

    const coverRaw = body.coverImageUrl?.trim() ?? "";
    const cover =
      coverRaw && isAllowedStoredFileUrl(coverRaw) ? coverRaw : null;
    const gallery = parseGallery(body.galleryImageUrls);

    const pool = await getPool();
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.landlord_properties
        (owner_user_id, name, address, city, contact_phone, contact_email,
         property_type, description, total_rooms, max_occupancy_capacity,
         latitude, longitude, cover_image_url, gallery_image_urls)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
       RETURNING id`,
      [
        session.sub,
        name,
        address,
        city,
        contactPhone,
        contactEmail,
        propertyType,
        description,
        totalRooms,
        maxOccupancyCapacity,
        lat,
        lng,
        cover,
        JSON.stringify(gallery),
      ]
    );
    const id = rows[0]?.id;
    await landlordLog(pool, session.sub, `Created property: ${name}`);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
