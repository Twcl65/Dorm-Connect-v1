import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";
import { unpackReview } from "@/lib/review-content";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      room_id: string;
      room_no: string;
      property_name: string;
      property_address: string | null;
      reservation_status: string;
      review_id: string | null;
      rating: number | null;
      comment: string | null;
      reviewed_at: Date | null;
    }>(
      `SELECT r.id AS room_id, r.room_no, p.name AS property_name, p.address AS property_address,
              s.status AS reservation_status,
              v.id AS review_id, v.rating, v.comment, v.created_at AS reviewed_at
       FROM public.student_dorm_reservations s
       JOIN public.landlord_rooms r ON r.id = s.room_id
       JOIN public.landlord_properties p ON p.id = r.property_id
       LEFT JOIN public.student_dorm_reviews v
         ON v.student_user_id = s.student_user_id AND v.room_id = r.id
       WHERE s.student_user_id = $1::uuid
         AND s.status IN ('Pending', 'Confirmed')
       ORDER BY s.created_at DESC, p.name, r.room_no`,
      [studentId]
    );

    const reviewableRooms = rows.map((x) => {
      const parsed = x.comment ? unpackReview(x.comment) : { title: "", comment: "" };
      return {
        roomId: x.room_id,
        roomNo: x.room_no,
        propertyName: x.property_name,
        propertyAddress: x.property_address?.trim() || null,
        reservationStatus: x.reservation_status,
        existingReview: x.review_id
          ? {
              id: x.review_id,
              rating: x.rating ?? 0,
              title: parsed.title,
              comment: parsed.comment,
              reviewedAt: x.reviewed_at
                ? new Date(x.reviewed_at).toISOString().slice(0, 10)
                : null,
            }
          : null,
      };
    });

    const myReviews = reviewableRooms
      .filter((r) => r.existingReview)
      .map((r) => ({
        roomId: r.roomId,
        roomNo: r.roomNo,
        propertyName: r.propertyName,
        propertyAddress: r.propertyAddress,
        reservationStatus: r.reservationStatus,
        ...r.existingReview!,
      }));

    return NextResponse.json({ reviewableRooms, myReviews });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load reviews";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
