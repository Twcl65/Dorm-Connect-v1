import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { unpackReview } from "@/lib/review-content";
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
    const { rows } = await pool.query<{
      id: string;
      rating: number;
      comment: string;
      created_at: Date;
      student_name: string;
      room_no: string;
      room_id: string;
      property_name: string;
      property_address: string | null;
      property_city: string | null;
    }>(
      `SELECT v.id, v.rating, v.comment, v.created_at,
              u.full_name AS student_name,
              r.room_no, r.id AS room_id,
              p.name AS property_name, p.address AS property_address, p.city AS property_city
       FROM public.student_dorm_reviews v
       JOIN public.landlord_rooms r ON r.id = v.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       JOIN public.boarding_house_app_users u ON u.id = v.student_user_id
       WHERE r.owner_user_id = $1::uuid
       ORDER BY v.created_at DESC`,
      [ownerId]
    );

    const reviews = rows.map((r) => {
      const { title, comment } = unpackReview(r.comment);
      return {
        id: r.id,
        rating: r.rating,
        title,
        comment,
        reviewedAt: new Date(r.created_at).toISOString().slice(0, 10),
        studentName: r.student_name,
        roomId: r.room_id,
        roomNo: r.room_no,
        propertyName: r.property_name,
        propertyAddress: [r.property_address, r.property_city]
          .filter(Boolean)
          .join(", ") || null,
      };
    });

    const totalReviews = reviews.length;
    const avgRating =
      totalReviews > 0
        ? Math.round(
            (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10
          ) / 10
        : null;

    return NextResponse.json({ reviews, totalReviews, avgRating });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load reviews";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
