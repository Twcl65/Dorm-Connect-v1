import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { landlordLog } from "@/lib/landlord-db";
import { requireLandlord } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

function parseGallery(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.startsWith("/uploads/"));
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
    const { rows: cur } = await pool.query<{ id: string }>(
      `SELECT id FROM public.landlord_properties
       WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
      [id, session.sub]
    );
    if (!cur[0]) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const updates: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (body.name !== undefined) {
      const n = String(body.name).trim();
      if (!n) {
        return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
      }
      updates.push(`name = $${i++}`);
      vals.push(n);
    }
    if (body.propertyType !== undefined) {
      const pt =
        body.propertyType === "Boarding House" ? "Boarding House" : "Dormitory";
      updates.push(`property_type = $${i++}`);
      vals.push(pt);
    }
    if (body.description !== undefined) {
      updates.push(`description = $${i++}`);
      vals.push(String(body.description));
    }
    if (body.address !== undefined) {
      updates.push(`address = $${i++}`);
      vals.push(body.address ? String(body.address).trim() : null);
    }
    if (body.city !== undefined) {
      updates.push(`city = $${i++}`);
      vals.push(body.city == null ? null : String(body.city).trim() || null);
    }
    if (body.contactPhone !== undefined) {
      updates.push(`contact_phone = $${i++}`);
      vals.push(
        body.contactPhone == null ? null : String(body.contactPhone).trim() || null
      );
    }
    if (body.contactEmail !== undefined) {
      updates.push(`contact_email = $${i++}`);
      vals.push(
        body.contactEmail == null ? null : String(body.contactEmail).trim() || null
      );
    }
    if (body.totalRooms !== undefined) {
      updates.push(`total_rooms = $${i++}`);
      vals.push(
        body.totalRooms == null || !Number.isFinite(Number(body.totalRooms))
          ? null
          : Math.max(0, Math.floor(Number(body.totalRooms)))
      );
    }
    if (body.maxOccupancyCapacity !== undefined) {
      updates.push(`max_occupancy_capacity = $${i++}`);
      vals.push(
        body.maxOccupancyCapacity == null ||
          !Number.isFinite(Number(body.maxOccupancyCapacity))
          ? null
          : Math.max(0, Math.floor(Number(body.maxOccupancyCapacity)))
      );
    }
    if (body.latitude !== undefined) {
      let lat =
        body.latitude == null || !Number.isFinite(Number(body.latitude))
          ? null
          : Number(body.latitude);
      if (lat != null && (lat < -90 || lat > 90)) lat = null;
      updates.push(`latitude = $${i++}`);
      vals.push(lat);
    }
    if (body.longitude !== undefined) {
      let lng =
        body.longitude == null || !Number.isFinite(Number(body.longitude))
          ? null
          : Number(body.longitude);
      if (lng != null && (lng < -180 || lng > 180)) lng = null;
      updates.push(`longitude = $${i++}`);
      vals.push(lng);
    }
    if (body.coverImageUrl !== undefined) {
      const c = body.coverImageUrl?.trim();
      updates.push(`cover_image_url = $${i++}`);
      vals.push(c && c.startsWith("/uploads/") ? c : null);
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
    const { rows: block } = await pool.query<{ b: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM public.student_dorm_reservations s
         JOIN public.landlord_rooms r ON r.id = s.room_id
         WHERE r.property_id = $1::uuid AND s.status IN ('Pending', 'Confirmed')
       ) OR EXISTS (
         SELECT 1 FROM public.landlord_tenant_leases l
         WHERE l.property_id = $1::uuid
       ) AS b`,
      [id]
    );
    if (block[0]?.b) {
      return NextResponse.json(
        {
          error:
            "Cannot delete this property while it has active reservations or tenant leases.",
        },
        { status: 400 }
      );
    }

    const { rowCount } = await pool.query(
      `DELETE FROM public.landlord_properties
       WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
      [id, session.sub]
    );
    if (!rowCount) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await landlordLog(pool, session.sub, `Deleted property ${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
