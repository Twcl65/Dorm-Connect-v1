import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { requireStudent } from "@/lib/require-student";
import { packReview, unpackReview } from "@/lib/review-content";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const roomId = new URL(req.url).searchParams.get("roomId");
  if (!roomId || !/^[0-9a-f-]{36}$/i.test(roomId)) {
    return NextResponse.json({ error: "roomId required." }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const { rows } = await pool.query<{
      author: string;
      created_at: Date;
      comment: string;
      rating: number;
    }>(
      `SELECT u.full_name AS author, v.created_at, v.comment, v.rating
       FROM public.student_dorm_reviews v
       JOIN public.boarding_house_app_users u ON u.id = v.student_user_id
       WHERE v.room_id = $1::uuid
       ORDER BY v.created_at DESC
       LIMIT 50`,
      [roomId]
    );

    return NextResponse.json({
      reviews: rows.map((r) => {
        const { title, comment } = unpackReview(r.comment);
        return {
          author: r.author,
          date: new Date(r.created_at).toISOString().slice(0, 10),
          title,
          comment,
          rating: r.rating,
        };
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load reviews";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireStudent();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const studentId = session.sub;

  try {
    const body = (await req.json()) as {
      roomId?: string;
      rating?: number;
      title?: string;
      comment?: string;
    };
    const roomId = (body.roomId ?? "").trim();
    const rating = Math.min(5, Math.max(1, Number(body.rating) || 0));
    const title = (body.title ?? "").trim();
    const comment = (body.comment ?? "").trim();
    if (!roomId || !/^[0-9a-f-]{36}$/i.test(roomId)) {
      return NextResponse.json({ error: "Invalid room." }, { status: 400 });
    }
    if (rating < 1) {
      return NextResponse.json({ error: "Rating 1–5 required." }, { status: 400 });
    }
    if (!comment) {
      return NextResponse.json(
        { error: "Review description is required." },
        { status: 400 }
      );
    }

    const pool = await getPool();
    const { rows: booking } = await pool.query<{ id: string }>(
      `SELECT s.id
       FROM public.student_dorm_reservations s
       WHERE s.student_user_id = $1::uuid
         AND s.room_id = $2::uuid
         AND s.status IN ('Pending', 'Confirmed')
       LIMIT 1`,
      [studentId, roomId]
    );
    if (!booking[0]) {
      return NextResponse.json(
        {
          error:
            "You can only review a dormitory you have booked (active reservation required).",
        },
        { status: 403 }
      );
    }

    await pool.query(
      `INSERT INTO public.student_dorm_reviews (student_user_id, room_id, rating, comment)
       VALUES ($1::uuid, $2::uuid, $3, $4)
       ON CONFLICT (student_user_id, room_id) DO UPDATE SET
         rating = EXCLUDED.rating,
         comment = EXCLUDED.comment,
         created_at = now()`,
      [studentId, roomId, rating, packReview(title, comment)]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save review";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
