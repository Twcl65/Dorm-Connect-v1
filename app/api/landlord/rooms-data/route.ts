import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  ensureLandlordProperty,
  formatLeasePeriod,
  resolveDormDisplayName,
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

    const { rows: prop } = await pool.query<{
      name: string;
      acc_dorm_name: string | null;
    }>(
      `SELECT p.name,
              (SELECT a.dorm_name FROM public.landlord_accreditation_requests a
               WHERE (a.property_id = p.id OR a.owner_user_id = p.owner_user_id)
                 AND trim(a.dorm_name) <> ''
               ORDER BY a.submitted_at DESC
               LIMIT 1) AS acc_dorm_name
       FROM public.landlord_properties p
       WHERE p.id = $1::uuid`,
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
      listing_background_url: string | null;
      room_image_urls: unknown;
      room_size_label: string | null;
      room_details: string | null;
    }>(
      `SELECT id, room_no, capacity, monthly_rate::text, status, remarks,
              is_listed, listing_location, listing_description, listing_image_urls,
              listing_background_url, room_image_urls, room_size_label, room_details
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

    const propertyName = resolveDormDisplayName(
      prop[0]?.name,
      prop[0]?.acc_dorm_name ?? null
    );

    return NextResponse.json({
      propertyName,
      propertyId,
      stats: { total, occupied, available, maintenance },
      rooms: rooms.map((r) => {
        const imgs = Array.isArray(r.listing_image_urls)
          ? (r.listing_image_urls as string[])
          : [];
        const roomImgs = Array.isArray(r.room_image_urls)
          ? (r.room_image_urls as string[])
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
          listingBackgroundUrl: r.listing_background_url ?? undefined,
          roomImageUrls: roomImgs,
          roomSizeLabel: r.room_size_label ?? undefined,
          roomDetails: r.room_details ?? undefined,
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
