import { NextResponse } from "next/server";
import {
  invalidateLandlordUser,
  invalidatePublicProperties,
} from "@/lib/api-cache";
import {
  normalizeLandlordPropertyPayload,
  validateLandlordPropertyPayload,
  type PropertyType,
} from "@/lib/landlord-property-validation";
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

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, context: Ctx) {
  const session = await requireLandlord();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      propertyType?: string;
      description?: string;
      address?: string | null;
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

    const pool = await getPool();
    const { rows: cur } = await pool.query<{
      id: string;
      name: string;
      property_type: string;
      description: string;
      address: string | null;
      city: string | null;
      contact_phone: string | null;
      contact_email: string | null;
      total_rooms: number | null;
      max_occupancy_capacity: number | null;
      latitude: number | null;
      longitude: number | null;
    }>(
      `SELECT id, name, property_type, description, address, city, contact_phone,
              contact_email, total_rooms, max_occupancy_capacity, latitude, longitude
       FROM public.landlord_properties
       WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
      [id, session.sub]
    );
    if (!cur[0]) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const current = cur[0];
    const merged = normalizeLandlordPropertyPayload({
      name: body.name !== undefined ? String(body.name) : current.name,
      propertyType: (body.propertyType !== undefined
        ? body.propertyType === "Boarding House"
          ? "Boarding House"
          : "Dormitory"
        : current.property_type) as PropertyType,
      description:
        body.description !== undefined
          ? String(body.description)
          : current.description ?? "",
      address:
        body.address !== undefined
          ? body.address
          : current.address,
      city: body.city !== undefined ? body.city : current.city,
      contactPhone:
        body.contactPhone !== undefined
          ? body.contactPhone
          : current.contact_phone,
      contactEmail:
        body.contactEmail !== undefined
          ? body.contactEmail
          : current.contact_email,
      totalRooms:
        body.totalRooms !== undefined ? body.totalRooms : current.total_rooms,
      maxOccupancyCapacity:
        body.maxOccupancyCapacity !== undefined
          ? body.maxOccupancyCapacity
          : current.max_occupancy_capacity,
      latitude:
        body.latitude !== undefined ? body.latitude : current.latitude,
      longitude:
        body.longitude !== undefined ? body.longitude : current.longitude,
    });

    const validationErrors = validateLandlordPropertyPayload(merged);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors.join(" ") },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${i++}`);
      vals.push(merged.name);
    }
    if (body.propertyType !== undefined) {
      updates.push(`property_type = $${i++}`);
      vals.push(merged.propertyType);
    }
    if (body.description !== undefined) {
      updates.push(`description = $${i++}`);
      vals.push(merged.description);
    }
    if (body.address !== undefined) {
      updates.push(`address = $${i++}`);
      vals.push(merged.address);
    }
    if (body.city !== undefined) {
      updates.push(`city = $${i++}`);
      vals.push(merged.city);
    }
    if (body.contactPhone !== undefined) {
      updates.push(`contact_phone = $${i++}`);
      vals.push(merged.contactPhone);
    }
    if (body.contactEmail !== undefined) {
      updates.push(`contact_email = $${i++}`);
      vals.push(merged.contactEmail);
    }
    if (body.totalRooms !== undefined) {
      updates.push(`total_rooms = $${i++}`);
      vals.push(merged.totalRooms);
    }
    if (body.maxOccupancyCapacity !== undefined) {
      updates.push(`max_occupancy_capacity = $${i++}`);
      vals.push(merged.maxOccupancyCapacity);
    }
    if (body.latitude !== undefined) {
      updates.push(`latitude = $${i++}`);
      vals.push(merged.latitude);
    }
    if (body.longitude !== undefined) {
      updates.push(`longitude = $${i++}`);
      vals.push(merged.longitude);
    }
    if (body.coverImageUrl !== undefined) {
      const c = body.coverImageUrl?.trim();
      updates.push(`cover_image_url = $${i++}`);
      vals.push(c && isAllowedStoredFileUrl(c) ? c : null);
    }
    if (body.galleryImageUrls !== undefined) {
      updates.push(`gallery_image_urls = $${i++}::jsonb`);
      vals.push(JSON.stringify(parseGallery(body.galleryImageUrls)));
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No changes." }, { status: 400 });
    }

    updates.push("updated_at = now()");
    const idPh = i;
    const ownPh = i + 1;
    vals.push(id, session.sub);

    await pool.query(
      `UPDATE public.landlord_properties
       SET ${updates.join(", ")}
       WHERE id = $${idPh}::uuid AND owner_user_id = $${ownPh}::uuid`,
      vals
    );
    await landlordLog(pool, session.sub, `Updated property ${id}`);
    invalidateLandlordUser(session.sub);
    invalidatePublicProperties();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Ctx) {
  const session = await requireLandlord();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid property id." }, { status: 400 });
  }

  try {
    const pool = await getPool();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM public.landlord_accreditation_requests
         WHERE property_id = $1::uuid
            OR (
              owner_user_id = $2::uuid
              AND property_id IS NULL
              AND lower(trim(dorm_name)) = lower(trim((
                SELECT name FROM public.landlord_properties
                WHERE id = $1::uuid AND owner_user_id = $2::uuid
              )))
            )`,
        [id, session.sub]
      );
      const { rowCount } = await client.query(
        `DELETE FROM public.landlord_properties
         WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
        [id, session.sub]
      );
      if (!rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Not found." }, { status: 404 });
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    await landlordLog(pool, session.sub, `Deleted property ${id}`);
    invalidateLandlordUser(session.sub);
    invalidatePublicProperties();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
