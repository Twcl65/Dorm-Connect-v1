import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  buildPublicListingDescription,
  buildRoomListingGallery,
} from "@/lib/listing-description";
import { requireStudent } from "@/lib/require-student";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pool = await getPool();
    const studentId = session.sub;

    const { rows: reservationRows } = await pool.query<{
      room_id: string;
      status: string;
    }>(
      `SELECT DISTINCT ON (s.room_id) s.room_id, s.status
       FROM public.student_dorm_reservations s
       WHERE s.student_user_id = $1::uuid
         AND s.status IN ('Pending', 'Confirmed')
       ORDER BY s.room_id, s.created_at DESC`,
      [studentId]
    );
    const reservationByRoom = new Map(
      reservationRows.map((r) => [
        r.room_id,
        r.status as "Pending" | "Confirmed",
      ])
    );

    const { rows } = await pool.query<{
      room_id: string;
      room_no: string;
      monthly_rate: string;
      capacity: number;
      listing_location: string | null;
      listing_description: string | null;
      remarks: string | null;
      property_name: string;
      property_address: string | null;
      property_city: string | null;
      property_contact_phone: string | null;
      property_description: string | null;
      cover_image_url: string | null;
      latitude: string | null;
      longitude: string | null;
      landlord_name: string;
      property_id: string;
      listing_image_urls: unknown;
      listing_background_url: string | null;
      room_image_urls: unknown;
      room_size_label: string | null;
      room_details: string | null;
    }>(
      `SELECT r.id AS room_id, r.room_no, r.monthly_rate::text, r.capacity,
              r.listing_location, r.listing_description, r.remarks,
              r.listing_image_urls, r.listing_background_url,
              r.room_image_urls, r.room_size_label, r.room_details,
              p.name AS property_name, p.address AS property_address, p.city AS property_city,
              p.contact_phone AS property_contact_phone,
              p.description AS property_description,
              p.cover_image_url,
              p.latitude::text AS latitude, p.longitude::text AS longitude,
              u.full_name AS landlord_name, p.id AS property_id
       FROM public.landlord_rooms r
       JOIN public.landlord_properties p ON p.id = r.property_id
       JOIN public.boarding_house_app_users u ON u.id = r.owner_user_id
       WHERE r.is_listed = true
         AND r.status = 'Available'
         AND p.operational_status <> 'Not Operating'
         AND EXISTS (
           SELECT 1 FROM public.landlord_accreditation_requests acc
           WHERE acc.property_id = p.id AND acc.status = 'Approved'
         )
       ORDER BY p.name, r.room_no`
    );

    const listings = await Promise.all(
      rows.map(async (row) => {
        const documentType = "Accredited";

        const { rows: rev } = await pool.query<{
          avg_rating: string | null;
          cnt: string;
        }>(
          `SELECT AVG(rating)::text AS avg_rating, COUNT(*)::text AS cnt
           FROM public.student_dorm_reviews WHERE room_id = $1::uuid`,
          [row.room_id]
        );
        const avg = rev[0]?.avg_rating ? Number(rev[0].avg_rating) : null;
        const reviewCount = Number(rev[0]?.cnt ?? 0);

        const loc =
          row.listing_location?.trim() ||
          [row.property_address, row.property_city].filter(Boolean).join(", ") ||
          "Location on request";

        const listingBody = buildPublicListingDescription(
          row.listing_description,
          row.remarks,
          row.room_details,
          `Room ${row.room_no} at ${row.property_name}. Contact the landlord for a tour.`
        );

        const images = buildRoomListingGallery(
          row.listing_image_urls,
          row.listing_background_url,
          row.room_image_urls
        );

        const sizeLine = row.room_size_label?.trim();
        const extra = row.room_details?.trim();
        const amenities = [
          "Listed on DormConnect",
          ...(sizeLine ? [`Size: ${sizeLine}`] : []),
        ];

        const myReservationStatus =
          reservationByRoom.get(row.room_id) ?? null;

        const latRaw = row.latitude?.trim();
        const lngRaw = row.longitude?.trim();
        const latitude =
          latRaw != null && latRaw !== "" && !Number.isNaN(Number(latRaw))
            ? Number(latRaw)
            : null;
        const longitude =
          lngRaw != null && lngRaw !== "" && !Number.isNaN(Number(lngRaw))
            ? Number(lngRaw)
            : null;

        return {
          id: row.room_id,
          name: `${row.property_name} – Room ${row.room_no}`,
          price: Number(row.monthly_rate),
          location: loc,
          documentType,
          description: listingBody,
          distance: "—",
          landlord: row.landlord_name,
          roomType: `${row.capacity}-bed capacity`,
          capacity: String(row.capacity),
          roomSizeLabel: sizeLine ?? null,
          roomDetails: extra ?? null,
          amenities,
          images,
          reviewSummary: { avg, count: reviewCount },
          myReservationStatus,
          propertyId: row.property_id,
          propertyName: row.property_name,
          propertyAddress: row.property_address?.trim() || null,
          propertyCity: row.property_city?.trim() || null,
          propertyContactPhone: row.property_contact_phone?.trim() || null,
          propertyDescription:
            row.property_description?.trim() || null,
          propertyCoverImageUrl: row.cover_image_url?.trim() || null,
          latitude,
          longitude,
        };
      })
    );

    return NextResponse.json({ listings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load listings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
