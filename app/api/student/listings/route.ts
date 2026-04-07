import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const pool = await getPool();
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
      landlord_name: string;
      property_id: string;
      listing_image_urls: unknown;
    }>(
      `SELECT r.id AS room_id, r.room_no, r.monthly_rate::text, r.capacity,
              r.listing_location, r.listing_description, r.remarks, r.listing_image_urls,
              p.name AS property_name, p.address AS property_address, p.city AS property_city,
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

        const desc =
          row.listing_description?.trim() ||
          row.remarks?.trim() ||
          `Room ${row.room_no} at ${row.property_name}. Contact the landlord for a tour.`;

        const uploaded =
          Array.isArray(row.listing_image_urls) &&
          (row.listing_image_urls as string[]).every((x) => typeof x === "string")
            ? (row.listing_image_urls as string[])
            : [];
        const fallback =
          "https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=1200";
        const images = uploaded.length > 0 ? uploaded : [fallback];

        return {
          id: row.room_id,
          name: `${row.property_name} – Room ${row.room_no}`,
          price: Number(row.monthly_rate),
          location: loc,
          documentType,
          description: desc,
          distance: "—",
          landlord: row.landlord_name,
          roomType: `${row.capacity}-bed capacity`,
          capacity: String(row.capacity),
          amenities: ["Listed on DormConnect"] as string[],
          images,
          reviewSummary: { avg, count: reviewCount },
        };
      })
    );

    return NextResponse.json({ listings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load listings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
