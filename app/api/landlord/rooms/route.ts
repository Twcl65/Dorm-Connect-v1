import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureLandlordProperty, landlordLog } from "@/lib/landlord-db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const body = (await req.json()) as {
      roomNo?: string;
      capacity?: number;
      rate?: number;
      remarks?: string;
      status?: string;
    };
    const roomNo = (body.roomNo ?? "").trim();
    if (!roomNo) {
      return NextResponse.json({ error: "Room number is required." }, { status: 400 });
    }
    const capacity = Math.max(1, Number(body.capacity) || 1);
    const rate = Math.max(0, Number(body.rate) || 0);
    const status =
      body.status === "Occupied" ||
      body.status === "Available" ||
      body.status === "Maintenance"
        ? body.status
        : "Available";
    const remarks = (body.remarks ?? "").trim() || null;

    const pool = await getPool();
    const propertyId = await ensureLandlordProperty(pool, ownerId);

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO public.landlord_rooms
        (owner_user_id, property_id, room_no, capacity, monthly_rate, status, remarks)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
       RETURNING id`,
      [ownerId, propertyId, roomNo, capacity, rate, status, remarks]
    );
    await landlordLog(
      pool,
      ownerId,
      `Added room ${roomNo} (${status}, ₱${rate}/mo)`
    );
    return NextResponse.json({ id: rows[0]?.id }, { status: 201 });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return NextResponse.json(
        { error: "A room with this number already exists." },
        { status: 409 }
      );
    }
    const msg = e instanceof Error ? e.message : "Failed to add room";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
