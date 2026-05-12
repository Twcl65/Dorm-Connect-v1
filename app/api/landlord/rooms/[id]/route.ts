import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { landlordLog } from "@/lib/landlord-db";
import { requireLandlord } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, context: Ctx) {
  const session = await requireLandlord();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid room id." }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      capacity?: number;
      rate?: number;
      status?: string;
      remarks?: string | null;
      isListed?: boolean;
      listingLocation?: string | null;
      listingDescription?: string | null;
      listingImageUrls?: string[];
      listingBackgroundUrl?: string | null;
      roomImageUrls?: string[];
      roomSizeLabel?: string | null;
      roomDetails?: string | null;
    };

    const pool = await getPool();
    const { rows: curRows } = await pool.query<{
      capacity: number;
      monthly_rate: string;
      status: string;
      remarks: string | null;
      is_listed: boolean;
      listing_location: string | null;
      listing_description: string | null;
      listing_image_urls: unknown;
      listing_background_url: string | null;
      room_image_urls: unknown;
      room_size_label: string | null;
      room_details: string | null;
      room_no: string;
    }>(
      `SELECT capacity, monthly_rate::text, status, remarks, is_listed,
              listing_location, listing_description, listing_image_urls,
              listing_background_url, room_image_urls, room_size_label, room_details, room_no
       FROM public.landlord_rooms
       WHERE owner_user_id = $1::uuid AND id = $2::uuid`,
      [ownerId, id]
    );
    const cur = curRows[0];
    if (!cur) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }

    const capacity =
      body.capacity != null ? Math.max(1, Number(body.capacity)) : cur.capacity;
    const monthlyRate =
      body.rate != null ? Math.max(0, Number(body.rate)) : Number(cur.monthly_rate);
    let status = cur.status;
    if (
      body.status === "Occupied" ||
      body.status === "Available" ||
      body.status === "Reserved" ||
      body.status === "Maintenance"
    ) {
      status = body.status;
    }
    const remarks =
      body.remarks !== undefined ? body.remarks : cur.remarks;
    const isListed =
      body.isListed !== undefined ? Boolean(body.isListed) : cur.is_listed;
    const listingLocation =
      body.listingLocation !== undefined
        ? body.listingLocation
        : cur.listing_location;
    const listingDescription =
      body.listingDescription !== undefined
        ? body.listingDescription
        : cur.listing_description;
    const listingImageUrls =
      body.listingImageUrls !== undefined
        ? body.listingImageUrls.filter(
            (u) => typeof u === "string" && u.startsWith("/uploads/")
          )
        : Array.isArray(cur.listing_image_urls)
          ? (cur.listing_image_urls as string[])
          : [];

    const listingBackgroundUrl =
      body.listingBackgroundUrl !== undefined
        ? body.listingBackgroundUrl &&
          body.listingBackgroundUrl.startsWith("/uploads/")
          ? body.listingBackgroundUrl
          : null
        : cur.listing_background_url;

    const roomImageUrls =
      body.roomImageUrls !== undefined
        ? body.roomImageUrls.filter(
            (u) => typeof u === "string" && u.startsWith("/uploads/")
          )
        : Array.isArray(cur.room_image_urls)
          ? (cur.room_image_urls as string[])
          : [];

    const roomSizeLabel =
      body.roomSizeLabel !== undefined
        ? body.roomSizeLabel
        : cur.room_size_label;
    const roomDetails =
      body.roomDetails !== undefined ? body.roomDetails : cur.room_details;

    await pool.query(
      `UPDATE public.landlord_rooms SET
        capacity = $1,
        monthly_rate = $2,
        status = $3,
        remarks = $4,
        is_listed = $5,
        listing_location = $6,
        listing_description = $7,
        listing_image_urls = $8::jsonb,
        listing_background_url = $9,
        room_image_urls = $10::jsonb,
        room_size_label = $11,
        room_details = $12,
        updated_at = now()
       WHERE owner_user_id = $13::uuid AND id = $14::uuid`,
      [
        capacity,
        monthlyRate,
        status,
        remarks,
        isListed,
        listingLocation,
        listingDescription,
        JSON.stringify(listingImageUrls),
        listingBackgroundUrl,
        JSON.stringify(roomImageUrls),
        roomSizeLabel,
        roomDetails,
        ownerId,
        id,
      ]
    );
    await landlordLog(pool, ownerId, `Updated room ${cur.room_no}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update room";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Ctx) {
  const session = await requireLandlord();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;
  const { id } = context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid room id." }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const { rows: block } = await pool.query<{ b: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM public.student_dorm_reservations
         WHERE room_id = $1::uuid AND status IN ('Pending', 'Confirmed')
       ) AS b`,
      [id]
    );
    if (block[0]?.b) {
      return NextResponse.json(
        { error: "Cannot delete a room with active or pending reservations." },
        { status: 400 }
      );
    }
    const { rowCount } = await pool.query(
      `DELETE FROM public.landlord_rooms
       WHERE id = $1::uuid AND owner_user_id = $2::uuid`,
      [id, ownerId]
    );
    if (!rowCount) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }
    await landlordLog(pool, ownerId, `Deleted room ${id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
