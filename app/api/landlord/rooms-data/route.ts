import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  ensureLandlordProperty,
  formatLeasePeriod,
} from "@/lib/landlord-db";
import { requireOwner } from "@/lib/require-owner";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const ownerId = session.sub;

  try {
    const pool = await getPool();
    const propertyId = await ensureLandlordProperty(pool, ownerId);

    const { rows: prop } = await pool.query<{ name: string }>(
      `SELECT name FROM public.landlord_properties WHERE id = $1::uuid`,
      [propertyId]
    );

    const { rows: rooms } = await pool.query<{
      id: string;
      room_no: string;
      capacity: number;
      monthly_rate: string;
      status: string;
      remarks: string | null;
      is_listed: boolean;
      listing_location: string | null;
      listing_description: string | null;
      listing_image_urls: unknown;
    }>(
      `SELECT id, room_no, capacity, monthly_rate::text, status, remarks,
              is_listed, listing_location, listing_description, listing_image_urls
       FROM public.landlord_rooms
       WHERE owner_user_id = $1::uuid
       ORDER BY room_no`,
      [ownerId]
    );

    const { rows: leases } = await pool.query<{
      id: string;
      room_id: string;
      room_no: string;
      room_status: string;
      tenant_name: string;
      lease_start: Date;
      lease_end: Date;
      payment_status: string;
    }>(
      `SELECT l.id, l.room_id, r.room_no, r.status AS room_status, l.tenant_name,
              l.lease_start, l.lease_end, l.payment_status
       FROM public.landlord_tenant_leases l
       JOIN public.landlord_rooms r ON r.id = l.room_id
       WHERE l.owner_user_id = $1::uuid
       ORDER BY r.room_no`,
      [ownerId]
    );

    const total = rooms.length;
    const occupied = rooms.filter((r) => r.status === "Occupied").length;
    const available = rooms.filter((r) => r.status === "Available").length;
    const maintenance = rooms.filter((r) => r.status === "Maintenance")
      .length;

    return NextResponse.json({
      propertyName: prop[0]?.name ?? "My property",
      propertyId,
      stats: { total, occupied, available, maintenance },
      rooms: rooms.map((r) => {
        const imgs = Array.isArray(r.listing_image_urls)
          ? (r.listing_image_urls as string[])
          : [];
        return {
          id: r.id,
          roomNo: r.room_no,
          capacity: r.capacity,
          rate: Number(r.monthly_rate),
          status: r.status,
          remarks: r.remarks ?? undefined,
          isListed: r.is_listed,
          listingLocation: r.listing_location ?? undefined,
          listingDescription: r.listing_description ?? undefined,
          listingImageUrls: imgs,
        };
      }),
      leaseRows: leases.map((l) => ({
        id: l.id,
        roomId: l.room_id,
        roomNo: l.room_no,
        name: l.tenant_name,
        leaseStart: new Date(l.lease_start).toISOString().slice(0, 10),
        leaseEnd: new Date(l.lease_end).toISOString().slice(0, 10),
        leasePeriod: formatLeasePeriod(
          new Date(l.lease_start),
          new Date(l.lease_end)
        ),
        paymentStatus: l.payment_status as "Paid" | "Pending" | "Overdue",
        status: l.room_status as "Occupied" | "Available" | "Maintenance",
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load rooms";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
