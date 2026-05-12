import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";
import {
  buildPublicListingDescription,
  buildRoomListingGallery,
} from "@/lib/listing-description";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pool = await getPool();
    const { rows: props } = await pool.query<{
      id: string;
      name: string;
      address: string | null;
      city: string | null;
      contact_phone: string | null;
      description: string;
      cover_image_url: string | null;
      gallery_image_urls: unknown;
      latitude: number;
      longitude: number;
      property_type: string;
      landlord_name: string;
      operational_status: string;
    }>(
      `SELECT p.id, p.name, p.address, p.city, p.contact_phone,
              COALESCE(NULLIF(trim(p.description), ''), '') AS description,
              p.cover_image_url, p.gallery_image_urls,
              p.latitude, p.longitude, p.property_type,
              u.full_name AS landlord_name, p.operational_status
       FROM public.landlord_properties p
       JOIN public.boarding_house_app_users u ON u.id = p.owner_user_id
       WHERE p.latitude IS NOT NULL
         AND p.longitude IS NOT NULL
         AND p.operational_status <> 'Not Operating'
         AND EXISTS (
           SELECT 1 FROM public.landlord_accreditation_requests a
           WHERE a.property_id = p.id AND a.status = 'Approved'
         )
         AND EXISTS (
           SELECT 1 FROM public.landlord_rooms r
           WHERE r.property_id = p.id
             AND r.is_listed = true
             AND r.status = 'Available'
         )
       ORDER BY p.name`
    );

    const out = [];
    for (const p of props) {
      const { rows: rooms } = await pool.query<{
        id: string;
        room_no: string;
        capacity: number;
        monthly_rate: string;
        status: string;
        listing_description: string | null;
        remarks: string | null;
        room_details: string | null;
        listing_image_urls: unknown;
        listing_background_url: string | null;
        room_image_urls: unknown;
      }>(
        `SELECT r.id, r.room_no, r.capacity, r.monthly_rate::text, r.status,
                r.listing_description, r.remarks, r.room_details,
                r.listing_image_urls, r.listing_background_url, r.room_image_urls
         FROM public.landlord_rooms r
         WHERE r.property_id = $1::uuid
           AND r.is_listed = true
           AND r.status = 'Available'
         ORDER BY r.room_no`,
        [p.id]
      );

      const gallery = Array.isArray(p.gallery_image_urls)
        ? (p.gallery_image_urls as string[])
        : [];
      const cover = p.cover_image_url?.trim() || null;
      const propertyImages = [
        ...(cover ? [cover] : []),
        ...gallery.filter((u) => typeof u === "string"),
      ];

      out.push({
        id: p.id,
        name: p.name,
        propertyType: p.property_type,
        address: [p.address, p.city].filter(Boolean).join(", ") || "—",
        contactPhone: p.contact_phone?.trim() || "—",
        description: p.description || "No description provided.",
        landlordName: p.landlord_name,
        latitude: p.latitude,
        longitude: p.longitude,
        coverImageUrl: cover,
        galleryImageUrls: gallery,
        propertyImages,
        rooms: rooms.map((r) => {
          const images = buildRoomListingGallery(
            r.listing_image_urls,
            r.listing_background_url,
            r.room_image_urls
          );
          const desc = buildPublicListingDescription(
            r.listing_description,
            r.remarks,
            r.room_details,
            `Room ${r.room_no}`
          );
          return {
            id: r.id,
            roomNo: r.room_no,
            capacity: r.capacity,
            price: Number(r.monthly_rate),
            status: r.status,
            description: desc,
            images: images.length ? images : propertyImages.slice(0, 1),
          };
        }),
      });
    }

    return NextResponse.json({ properties: out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load map data";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
